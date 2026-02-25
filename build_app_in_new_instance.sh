#!/bin/bash

# Function to cleanup and terminate the instance
cleanup() {
    echo "Cleaning up and terminating instance..."
    aws ec2 terminate-instances --instance-ids $TEMP_INSTANCE_ID
    exit
}

# Set up trap to call cleanup function on script exit
trap cleanup EXIT
trap cleanup EXIT INT

# Set to exit immediately if a command exits with a non-zero status
set -e

start_time=$(date +%s)


# 1. Create temporary EC2 instance
TEMP_INSTANCE_ID=$(aws ec2 run-instances --image-id ami-09e12010e9d1fb5a3 --instance-type t2.xlarge --key-name arx-analytics-key --security-group-ids sg-04efe18d868d9a023 --subnet-id subnet-0fe5d2cdf8329f8a5 --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp2"}}]' --query 'Instances[0].InstanceId' --output text)
# Wait for instance to be running
echo $TEMP_INSTANCE_ID
echo "EC2 instance is starting, please wait....."
aws ec2 wait instance-status-ok --instance-ids $TEMP_INSTANCE_ID
end_time=$(date +%s)
elapsed_time=$((end_time - start_time))
echo "Instance creation took $elapsed_time seconds."




# Get public IP of temporary instance
TEMP_DNS=$(aws ec2 describe-instances --instance-ids $TEMP_INSTANCE_ID --query 'Reservations[0].Instances[0].PublicDnsName' --output text)
# Copy script file
echo $TEMP_DNS
scp -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no ~/script_to_build_app_in_new_instance.sh ubuntu@$TEMP_DNS:/home/ubuntu/
scp -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no ~/twenty/packages/twenty-front/.env ubuntu@$TEMP_DNS:/home/ubuntu/.env_front
scp -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no ~/twenty/packages/twenty-server/.env ubuntu@$TEMP_DNS:/home/ubuntu/.env_server
echo "Maybe finished copying pem files"
# 2. Set up build environment (you'll need to SSH and do this manually or use a script)
# 3. Build your project (SSH and run build commands)
ssh -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no  ubuntu@$TEMP_DNS << EOF
        chmod +x script_to_build_app_in_new_instance.sh
        ./script_to_build_app_in_new_instance.sh
EOF
# 4. Transfer build files

# For server files
# First ensure the dist directory exists
mkdir -p /home/ubuntu/twenty/packages/twenty-server/dist
# Clear existing files
sudo rm -rf /home/ubuntu/twenty/packages/twenty-server/dist/*
# Copy new server files
scp -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no -r ubuntu@$TEMP_DNS:/home/ubuntu/twenty/packages/twenty-server/dist/* /home/ubuntu/twenty/packages/twenty-server/dist/

# For frontend files
# First ensure the build directory exists
mkdir -p /home/ubuntu/twenty/packages/twenty-front/build
# Clear existing files
sudo rm -rf /home/ubuntu/twenty/packages/twenty-front/build/*
# Copy new frontend files
sudo scp -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no -r ubuntu@$TEMP_DNS:/home/ubuntu/twenty/packages/twenty-front/build/* /home/ubuntu/twenty/packages/twenty-front/build/

mkdir -p /home/ubuntu/twenty/packages/twenty-shared/dist
# Clear existing files
sudo rm -rf /home/ubuntu/twenty/packages/twenty-shared/dist/*
# Copy new shared library files
scp -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no -r ubuntu@$TEMP_DNS:/home/ubuntu/twenty/packages/twenty-shared/dist/* /home/ubuntu/twenty/packages/twenty-shared/dist/

mkdir -p /home/ubuntu/twenty/packages/twenty-orgchart/dist
# Clear existing files
sudo rm -rf /home/ubuntu/twenty/packages/twenty-orgchart/dist/*
# Copy new twenty-orgchart library files
scp -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no -r ubuntu@$TEMP_DNS:/home/ubuntu/twenty/packages/twenty-orgchart/dist/* /home/ubuntu/twenty/packages/twenty-orgchart/dist/

mkdir -p /home/ubuntu/twenty/packages/twenty-front/src/locales/generated
# Clear existing files
sudo rm -rf /home/ubuntu/twenty/packages/twenty-front/src/locales/generated/*
# Copy new locale files
scp -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no -r ubuntu@$TEMP_DNS:/home/ubuntu/twenty/packages/twenty-front/src/locales/generated/* /home/ubuntu/twenty/packages/twenty-front/src/locales/generated/

# For server locale files (if needed)
mkdir -p /home/ubuntu/twenty/packages/twenty-server/src/engine/core-modules/i18n/locales/generated
# Clear existing files
sudo rm -rf /home/ubuntu/twenty/packages/twenty-server/src/engine/core-modules/i18n/locales/generated/*
# Copy new locale files
scp -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no -r ubuntu@$TEMP_DNS:/home/ubuntu/twenty/packages/twenty-server/src/engine/core-modules/i18n/locales/generated/* /home/ubuntu/twenty/packages/twenty-server/src/engine/core-modules/i18n/locales/generated/


# For emails files
mkdir -p /home/ubuntu/twenty/packages/twenty-emails/dist
# Clear existing files
sudo rm -rf /home/ubuntu/twenty/packages/twenty-emails/dist/*
# Copy new emails files
scp -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no -r ubuntu@$TEMP_DNS:/home/ubuntu/twenty/packages/twenty-emails/dist/* /home/ubuntu/twenty/packages/twenty-emails/dist/

# For twenty-mcp-server files
mkdir -p /home/ubuntu/twenty/packages/twenty-mcp-server/dist
# Clear existing files
sudo rm -rf /home/ubuntu/twenty/packages/twenty-mcp-server/dist/*
# Copy new twenty-mcp-server files
scp -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no -r ubuntu@$TEMP_DNS:/home/ubuntu/twenty/packages/twenty-mcp-server/dist/* /home/ubuntu/twenty/packages/twenty-mcp-server/dist/

mkdir -p /home/ubuntu/twenty/packages/twenty-website/dist
# Clear existing files
sudo rm -rf /home/ubuntu/twenty/packages/twenty-website/dist/*
# Copy new twenty-website files
scp -i ~/arx-analytics-key.pem -o StrictHostKeyChecking=no -r ubuntu@$TEMP_DNS:/home/ubuntu/twenty/packages/twenty-website/dist/* /home/ubuntu/twenty/packages/twenty-website/dist/

cd /home/ubuntu/twenty
# Compile lingui catalogs for server
cd /home/ubuntu/twenty/packages/twenty-server
npx lingui compile --verbose || npx nx run twenty-server:lingui:compile

# Compile lingui catalogs for frontend  
cd /home/ubuntu/twenty/packages/twenty-front
npx lingui compile --verbose || npx nx run twenty-front:lingui:compile

echo "Restarting NGINX and PM2"
# 6. Restart services
sudo systemctl restart nginx
pm2 restart all

TZ=Asia/Kolkata date "+%Y-%m-%d %H:%M:%S %Z"


echo "Operations Complete, Will Power Off"




