#!/bin/bash
set -e

REGISTRY="558659058402.dkr.ecr.ap-northeast-1.amazonaws.com"
REPO="dev-obsidian-sync-server"
TAG="${1:-cthulu-lab-latest}"

echo "── Building $REPO:$TAG ──"

aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin $REGISTRY

cd "$(dirname "$0")/../services/web"
docker build --platform linux/amd64 -t $REGISTRY/$REPO:$TAG .
docker push $REGISTRY/$REPO:$TAG

echo "── Pushed $REGISTRY/$REPO:$TAG ──"
echo ""
echo "Deploy:"
echo "  kubectl apply -f deploy/k8s.yml"
echo "  kubectl -n cthulu-bot set image deployment/cthulu-lab cthulu-lab=$REGISTRY/$REPO:$TAG"
