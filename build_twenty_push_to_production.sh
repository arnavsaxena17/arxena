git add .
git commit -m "chnages"
git push
echo "Commits Pushed"
ssh -i "~/arx-analytics-key.pem" ubuntu@ec2-184-72-74-33.compute-1.amazonaws.com "nohup ./build_app_in_new_instance.sh > output.log 2>&1 &"
echo "SSHed into Remote"
