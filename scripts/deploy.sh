#!/bin/bash
set -e

# =============================================================================
# Journal Recommender - AWS Deployment Script
# =============================================================================
# Single command to deploy the entire application to AWS ECS.
#
# Usage:
#   npm run deploy
#   # or
#   ./scripts/deploy.sh
#
# What it does (all idempotent - safe to run multiple times):
#   1. Creates ECR repositories (if not exists)
#   2. Creates ECS cluster (if not exists)
#   3. Sets up ALB target groups (if not exists)
#   4. Creates database and schema (if not exists)
#   5. Builds and pushes Docker images
#   6. Creates/updates ECS task definitions and services
#
# Prerequisites:
#   - Docker installed and running
#   - .env.deploy file configured (copy from .env.deploy.example)
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() { echo -e "${GREEN}[INFO]${NC} $1"; }
log_warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Load environment variables
load_env() {
    if [ -f "$PROJECT_ROOT/.env.deploy" ]; then
        log_info "Loading environment from .env.deploy"
        set -a
        source "$PROJECT_ROOT/.env.deploy"
        set +a
    else
        log_error ".env.deploy not found. Copy .env.deploy.example and fill in your values."
        exit 1
    fi

    # Validate required variables
    required_vars=(
        "AWS_ACCESS_KEY_ID"
        "AWS_SECRET_ACCESS_KEY"
        "AWS_DEFAULT_REGION"
        "AWS_ACCOUNT_ID"
        "ECR_BACKEND_REPO"
        "ECR_FRONTEND_REPO"
        "RDS_HOST"
        "RDS_DATABASE"
        "RDS_USERNAME"
        "RDS_PASSWORD"
    )

    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            log_error "Required variable $var is not set in .env.deploy"
            exit 1
        fi
    done

    # Derived variables
    ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_DEFAULT_REGION}.amazonaws.com"
    BACKEND_IMAGE="${ECR_REGISTRY}/${ECR_BACKEND_REPO}"
    FRONTEND_IMAGE="${ECR_REGISTRY}/${ECR_FRONTEND_REPO}"
    DATABASE_URL="postgresql://${RDS_USERNAME}:${RDS_PASSWORD}@${RDS_HOST}:${RDS_PORT:-5432}/${RDS_DATABASE}"
}

# Run AWS CLI command (via Docker or local)
aws_cli() {
    if command -v aws &> /dev/null; then
        aws "$@"
    else
        docker run --rm \
            -e AWS_ACCESS_KEY_ID \
            -e AWS_SECRET_ACCESS_KEY \
            -e AWS_DEFAULT_REGION \
            amazon/aws-cli "$@"
    fi
}

# ECR login
ecr_login() {
    log_info "Logging into ECR..."
    aws_cli ecr get-login-password --region "$AWS_DEFAULT_REGION" | \
        docker login --username AWS --password-stdin "$ECR_REGISTRY"
}

# Create ECR repositories
create_ecr_repos() {
    log_info "Creating ECR repositories..."

    for repo in "$ECR_BACKEND_REPO" "$ECR_FRONTEND_REPO"; do
        if aws_cli ecr describe-repositories --repository-names "$repo" >/dev/null 2>&1; then
            log_warn "Repository $repo already exists"
        else
            aws_cli ecr create-repository \
                --repository-name "$repo" \
                --image-scanning-configuration scanOnPush=false >/dev/null
            log_info "Created repository: $repo"
        fi
    done
}

# Build Docker images
build_images() {
    log_info "Building Docker images..."

    cd "$PROJECT_ROOT"

    # Build backend
    log_info "Building backend image..."
    docker build -t "${ECR_BACKEND_REPO}:latest" -f backend/Dockerfile backend/

    # Build frontend with API URL
    log_info "Building frontend image..."
    docker build \
        -t "${ECR_FRONTEND_REPO}:latest" \
        --build-arg VITE_API_URL="${API_URL:-http://localhost:3001}" \
        -f frontend/Dockerfile frontend/

    log_info "Images built successfully"
}

# Tag and push images to ECR
push_images() {
    log_info "Pushing images to ECR..."

    ecr_login

    # Tag and push backend
    docker tag "${ECR_BACKEND_REPO}:latest" "${BACKEND_IMAGE}:latest"
    docker push "${BACKEND_IMAGE}:latest"
    log_info "Pushed: ${BACKEND_IMAGE}:latest"

    # Tag and push frontend
    docker tag "${ECR_FRONTEND_REPO}:latest" "${FRONTEND_IMAGE}:latest"
    docker push "${FRONTEND_IMAGE}:latest"
    log_info "Pushed: ${FRONTEND_IMAGE}:latest"
}

# Create ECS cluster
create_ecs_cluster() {
    log_info "Creating ECS cluster..."

    CLUSTER_NAME="${ECS_CLUSTER:-jrs-cluster}"

    if aws_cli ecs describe-clusters --clusters "$CLUSTER_NAME" --query "clusters[?status=='ACTIVE'].clusterName" --output text 2>/dev/null | grep -q "$CLUSTER_NAME"; then
        log_warn "Cluster $CLUSTER_NAME already exists"
    else
        aws_cli ecs create-cluster --cluster-name "$CLUSTER_NAME" >/dev/null
        log_info "Created cluster: $CLUSTER_NAME"
    fi
}

# Create ECS task definitions
create_task_definitions() {
    log_info "Creating ECS task definitions..."

    # Backend task definition - use env vars from .env.deploy
    aws_cli ecs register-task-definition --cli-input-json "{
        \"family\": \"${ECS_SERVICE_BACKEND}\",
        \"networkMode\": \"awsvpc\",
        \"requiresCompatibilities\": [\"FARGATE\"],
        \"cpu\": \"256\",
        \"memory\": \"512\",
        \"executionRoleArn\": \"arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole\",
        \"containerDefinitions\": [
            {
                \"name\": \"backend\",
                \"image\": \"${BACKEND_IMAGE}:latest\",
                \"essential\": true,
                \"portMappings\": [
                    {
                        \"containerPort\": 3001,
                        \"protocol\": \"tcp\"
                    }
                ],
                \"environment\": [
                    {\"name\": \"NODE_ENV\", \"value\": \"production\"},
                    {\"name\": \"PORT\", \"value\": \"3001\"},
                    {\"name\": \"DATABASE_URL\", \"value\": \"${DATABASE_URL}\"}
                ],
                \"logConfiguration\": {
                    \"logDriver\": \"awslogs\",
                    \"options\": {
                        \"awslogs-group\": \"/ecs/${ECS_SERVICE_BACKEND}\",
                        \"awslogs-region\": \"${AWS_DEFAULT_REGION}\",
                        \"awslogs-stream-prefix\": \"ecs\",
                        \"awslogs-create-group\": \"true\"
                    }
                }
            }
        ]
    }" >/dev/null
    log_info "Registered backend task definition: ${ECS_SERVICE_BACKEND}"

    # Frontend task definition - use env vars from .env.deploy
    aws_cli ecs register-task-definition --cli-input-json "{
        \"family\": \"${ECS_SERVICE_FRONTEND}\",
        \"networkMode\": \"awsvpc\",
        \"requiresCompatibilities\": [\"FARGATE\"],
        \"cpu\": \"256\",
        \"memory\": \"512\",
        \"executionRoleArn\": \"arn:aws:iam::${AWS_ACCOUNT_ID}:role/ecsTaskExecutionRole\",
        \"containerDefinitions\": [
            {
                \"name\": \"frontend\",
                \"image\": \"${FRONTEND_IMAGE}:latest\",
                \"essential\": true,
                \"portMappings\": [
                    {
                        \"containerPort\": 80,
                        \"protocol\": \"tcp\"
                    }
                ],
                \"environment\": [
                    {\"name\": \"API_URL\", \"value\": \"${API_URL}\"}
                ],
                \"logConfiguration\": {
                    \"logDriver\": \"awslogs\",
                    \"options\": {
                        \"awslogs-group\": \"/ecs/${ECS_SERVICE_FRONTEND}\",
                        \"awslogs-region\": \"${AWS_DEFAULT_REGION}\",
                        \"awslogs-stream-prefix\": \"ecs\",
                        \"awslogs-create-group\": \"true\"
                    }
                }
            }
        ]
    }" >/dev/null
    log_info "Registered frontend task definition: ${ECS_SERVICE_FRONTEND}"
}

# Setup ALB target groups
setup_alb_target_groups() {
    log_info "Setting up ALB target groups..."

    # Derive target group names from env vars
    BACKEND_TG_NAME="${ECS_SERVICE_BACKEND}-tg"
    FRONTEND_TG_NAME="${ECS_SERVICE_FRONTEND}-tg"

    # Get VPC ID from ALB
    ALB_ARN=$(aws_cli elbv2 describe-load-balancers --names "${ALB_NAME}" --query "LoadBalancers[0].LoadBalancerArn" --output text)
    VPC_ID=$(aws_cli elbv2 describe-load-balancers --names "${ALB_NAME}" --query "LoadBalancers[0].VpcId" --output text)

    log_info "Using ALB: $ALB_ARN"
    log_info "VPC: $VPC_ID"

    # Create backend target group
    if aws_cli elbv2 describe-target-groups --names "${BACKEND_TG_NAME}" >/dev/null 2>&1; then
        log_warn "Backend target group already exists: ${BACKEND_TG_NAME}"
    else
        aws_cli elbv2 create-target-group \
            --name "${BACKEND_TG_NAME}" \
            --protocol HTTP \
            --port 3001 \
            --vpc-id "$VPC_ID" \
            --target-type ip \
            --health-check-path "/api/health" \
            --health-check-interval-seconds 30 >/dev/null
        log_info "Created backend target group: ${BACKEND_TG_NAME}"
    fi

    # Create frontend target group
    if aws_cli elbv2 describe-target-groups --names "${FRONTEND_TG_NAME}" >/dev/null 2>&1; then
        log_warn "Frontend target group already exists: ${FRONTEND_TG_NAME}"
    else
        aws_cli elbv2 create-target-group \
            --name "${FRONTEND_TG_NAME}" \
            --protocol HTTP \
            --port 80 \
            --vpc-id "$VPC_ID" \
            --target-type ip \
            --health-check-path "/health" \
            --health-check-interval-seconds 30 >/dev/null
        log_info "Created frontend target group: ${FRONTEND_TG_NAME}"
    fi
}

# Create/Update ECS services
create_ecs_services() {
    log_info "Creating/Updating ECS services..."

    # Use env vars from .env.deploy
    CLUSTER_NAME="${ECS_CLUSTER}"
    BACKEND_SERVICE="${ECS_SERVICE_BACKEND}"
    FRONTEND_SERVICE="${ECS_SERVICE_FRONTEND}"
    SG_NAME="${ECS_CLUSTER}-sg"
    BACKEND_TG_NAME="${ECS_SERVICE_BACKEND}-tg"
    FRONTEND_TG_NAME="${ECS_SERVICE_FRONTEND}-tg"

    # Get subnet and security group info
    VPC_ID=$(aws_cli elbv2 describe-load-balancers --names "${ALB_NAME}" --query "LoadBalancers[0].VpcId" --output text)
    SUBNETS=$(aws_cli ec2 describe-subnets --filters "Name=vpc-id,Values=$VPC_ID" --query "Subnets[?MapPublicIpOnLaunch==\`true\`].SubnetId" --output text | tr '\t' ',')

    # Get or create security group
    SG_ID=$(aws_cli ec2 describe-security-groups --filters "Name=group-name,Values=${SG_NAME}" "Name=vpc-id,Values=$VPC_ID" --query "SecurityGroups[0].GroupId" --output text 2>/dev/null || echo "None")

    if [ "$SG_ID" == "None" ] || [ -z "$SG_ID" ]; then
        log_info "Creating security group: ${SG_NAME}"
        SG_ID=$(aws_cli ec2 create-security-group \
            --group-name "${SG_NAME}" \
            --description "Security group for ${ECS_CLUSTER} ECS tasks" \
            --vpc-id "$VPC_ID" \
            --query "GroupId" --output text)

        # Allow inbound traffic on ports 80 and 3001
        aws_cli ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 80 --cidr 0.0.0.0/0 >/dev/null
        aws_cli ec2 authorize-security-group-ingress --group-id "$SG_ID" --protocol tcp --port 3001 --cidr 0.0.0.0/0 >/dev/null
        # Allow outbound traffic
        aws_cli ec2 authorize-security-group-egress --group-id "$SG_ID" --protocol -1 --cidr 0.0.0.0/0 2>/dev/null || true
    fi

    log_info "Using security group: $SG_ID"
    log_info "Using subnets: $SUBNETS"

    # Get target group ARNs
    BACKEND_TG_ARN=$(aws_cli elbv2 describe-target-groups --names "${BACKEND_TG_NAME}" --query "TargetGroups[0].TargetGroupArn" --output text)
    FRONTEND_TG_ARN=$(aws_cli elbv2 describe-target-groups --names "${FRONTEND_TG_NAME}" --query "TargetGroups[0].TargetGroupArn" --output text)

    # Create or update backend service
    if aws_cli ecs describe-services --cluster "$CLUSTER_NAME" --services "${BACKEND_SERVICE}" --query "services[?status=='ACTIVE']" 2>/dev/null | grep -q "${BACKEND_SERVICE}"; then
        log_info "Updating backend service..."
        aws_cli ecs update-service \
            --cluster "$CLUSTER_NAME" \
            --service "${BACKEND_SERVICE}" \
            --task-definition "${BACKEND_SERVICE}" \
            --force-new-deployment >/dev/null
    else
        log_info "Creating backend service: ${BACKEND_SERVICE}"
        aws_cli ecs create-service \
            --cluster "$CLUSTER_NAME" \
            --service-name "${BACKEND_SERVICE}" \
            --task-definition "${BACKEND_SERVICE}" \
            --desired-count 1 \
            --launch-type FARGATE \
            --network-configuration "awsvpcConfiguration={subnets=[${SUBNETS}],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" \
            --load-balancers "targetGroupArn=$BACKEND_TG_ARN,containerName=backend,containerPort=3001" >/dev/null
    fi

    # Create or update frontend service
    if aws_cli ecs describe-services --cluster "$CLUSTER_NAME" --services "${FRONTEND_SERVICE}" --query "services[?status=='ACTIVE']" 2>/dev/null | grep -q "${FRONTEND_SERVICE}"; then
        log_info "Updating frontend service..."
        aws_cli ecs update-service \
            --cluster "$CLUSTER_NAME" \
            --service "${FRONTEND_SERVICE}" \
            --task-definition "${FRONTEND_SERVICE}" \
            --force-new-deployment >/dev/null
    else
        log_info "Creating frontend service: ${FRONTEND_SERVICE}"
        aws_cli ecs create-service \
            --cluster "$CLUSTER_NAME" \
            --service-name "${FRONTEND_SERVICE}" \
            --task-definition "${FRONTEND_SERVICE}" \
            --desired-count 1 \
            --launch-type FARGATE \
            --network-configuration "awsvpcConfiguration={subnets=[${SUBNETS}],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" \
            --load-balancers "targetGroupArn=$FRONTEND_TG_ARN,containerName=frontend,containerPort=80" >/dev/null
    fi

    log_info "ECS services created/updated"
}

# Initialize database
setup_database() {
    log_info "Setting up database..."

    # Helper function to run psql commands
    run_psql() {
        local db="$1"
        local cmd="$2"
        if command -v psql &> /dev/null; then
            PGPASSWORD="$RDS_PASSWORD" psql \
                "host=$RDS_HOST port=${RDS_PORT:-5432} user=$RDS_USERNAME dbname=$db sslmode=require" \
                -c "$cmd"
        else
            docker run --rm \
                -e PGPASSWORD="$RDS_PASSWORD" \
                postgres:16-alpine \
                psql "host=$RDS_HOST port=${RDS_PORT:-5432} user=$RDS_USERNAME dbname=$db sslmode=require" \
                -c "$cmd"
        fi
    }

    # Helper function to run psql with file
    run_psql_file() {
        local db="$1"
        local file="$2"
        if command -v psql &> /dev/null; then
            PGPASSWORD="$RDS_PASSWORD" psql \
                "host=$RDS_HOST port=${RDS_PORT:-5432} user=$RDS_USERNAME dbname=$db sslmode=require" \
                -f "$file"
        else
            docker run --rm \
                -e PGPASSWORD="$RDS_PASSWORD" \
                -v "$file:/init.sql:ro" \
                postgres:16-alpine \
                psql "host=$RDS_HOST port=${RDS_PORT:-5432} user=$RDS_USERNAME dbname=$db sslmode=require" \
                -f /init.sql
        fi
    }

    # Step 1: Create database if it doesn't exist
    log_info "Checking if database '$RDS_DATABASE' exists..."
    DB_EXISTS=$(run_psql "postgres" "SELECT 1 FROM pg_database WHERE datname = '$RDS_DATABASE';" 2>/dev/null | grep -c "1" || true)

    if [ "$DB_EXISTS" -eq 0 ]; then
        log_info "Creating database '$RDS_DATABASE'..."
        run_psql "postgres" "CREATE DATABASE $RDS_DATABASE;"
        log_info "Database created"
    else
        log_info "Database '$RDS_DATABASE' already exists"
    fi

    # Step 2: Run idempotent init.sql to create/update schema
    log_info "Running schema initialization (idempotent)..."
    run_psql_file "$RDS_DATABASE" "$PROJECT_ROOT/backend/database/init.sql"

    log_info "Database setup complete"
}

# Full deployment - runs everything
deploy() {
    log_info "=========================================="
    log_info "Starting full deployment..."
    log_info "=========================================="

    # Step 1: Create AWS infrastructure (idempotent)
    log_info "[1/6] Creating ECR repositories..."
    create_ecr_repos

    log_info "[2/6] Creating ECS cluster..."
    create_ecs_cluster

    log_info "[3/6] Setting up ALB target groups..."
    setup_alb_target_groups

    # Step 2: Setup database (idempotent)
    log_info "[4/6] Setting up database..."
    setup_database

    # Step 3: Build and push images
    log_info "[5/6] Building and pushing Docker images..."
    build_images
    push_images

    # Step 4: Create task definitions and deploy services
    log_info "[6/6] Deploying to ECS..."
    create_task_definitions
    create_ecs_services

    log_info "=========================================="
    log_info "Deployment complete!"
    log_info "=========================================="
    log_info "Frontend: https://jrs.kriyadocs.com"
    log_info "API: https://jrs.kriyadocs.com/api"
}

# Main
main() {
    load_env
    deploy
}

main "$@"
