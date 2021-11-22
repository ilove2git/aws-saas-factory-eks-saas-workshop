#!/bin/bash

source ./scripts/deploy-tenant-management.sh
envsubst < ./services/shared/apps/tenant-management/k8s/template.txt > ./services/shared/apps/tenant-management/k8s/template.yaml
kubectl apply -f ./services/shared/apps/tenant-management/k8s/template.yaml

source ./scripts/deploy-user-management.sh
envsubst < ./services/shared/apps/user-management/k8s/template.txt > ./services/shared/apps/user-management/k8s/template.yaml
kubectl apply -f ./services/shared/apps/user-management/k8s/template.yaml
