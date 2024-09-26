git add .
git commit -m "chnages"
git push
echo "Commits Pushed"
ssh -i "~/arx-analytics-key.pem" ubuntu@ec2-184-72-74-33.compute-1.amazonaws.com ./push_to_production.sh
echo "SSHed into Remote"
