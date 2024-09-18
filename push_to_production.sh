git add .
git commit -m "chnages"
git push
echo "Commits Pushed"
ssh -i "~/arxena-volk.pem" ubuntu@ec2-54-152-63-10.compute-1.amazonaws.com ./deploy_twenty.sh
echo "SSHed into Remote"
