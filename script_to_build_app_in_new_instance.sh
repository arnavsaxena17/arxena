#sudo apt update -y || sudo yum update -y
        # Install Node.js and npm (using Node.js 18.x as an example)
        #curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
        #sudo apt-get install -y nodejs || sudo yum install -y nodejs
        # Install git
        #sudo apt install -y git || sudo yum install -y git
        #sudo npm install -g @nestjs/cli
        #sudo npm install -D vite
        #sudo npm install --global yarn
	#sudo apt-get update
	#sudo apt install vite

        # Print versions for verification
       sudo apt update
       sudo apt install -y build-essential
       sudo apt install -y build-essential
       sudo apt install -y libsqlite3-dev
       yarn cache clean
       	echo "Node version: $(node -v)"
        echo "npm version: $(npm -v)"
        echo "Nest CLI version: $(nest --version)"
        echo "Vite version: $(vite --version)"
        echo "Build environment setup complete!"
	export NODE_OPTIONS="--max-old-space-size=4096"
	source ~/.nvm/nvm.sh
	nvm install 22
	nvm use 22

	echo "Node version: $(node -v)"
	echo "npm version: $(npm -v)"
	echo "Nest CLI version: $(nest --version)"
	echo "Vite version: $(vite --version)"

	git clone https://github.com/arnavsaxena17/twenty.git
       	cd twenty
	mv ~/.env_server ~/twenty/packages/twenty-server/.env
        mv ~/.env_front ~/twenty/packages/twenty-front/.env

	git checkout without-payment
      	# orgchart-test change branch if needed
	#rm -rf yarn.lock
        #touch yarn.lock
	#export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
        #[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm
        #nvm install
        #nvm use
        yarn

	echo "Git pulled, going to nest build"
	cd ~/twenty/
	yarn cache clean
	npx nx build twenty-shared
	yarn workspace twenty-shared build
	npx nx build twenty-orgchart
	yarn workspace twenty-orgchart build
	cd ~/twenty/packages/twenty-server/
       	mkdir -p src/engine/core-modules/i18n/locales/generated
	npx lingui extract --clean --verbose
	ls -la src/engine/core-modules/i18n/locales/
	npx lingui compile --verbose
	ls -la src/engine/core-modules/i18n/locales/generated/
       	nest build -p tsconfig.build.json
        echo "Nest Built, going  to yarn build"
        cd ~/twenty/packages/twenty-front/
	mkdir -p src/locales/generated
# Run extraction with verbose output
	npx lingui extract --clean --verbose
# Check what was extracted
	ls -la src/locales/
# Compile with verbose output
	npx lingui compile --verbose
# Check the compiled output
        ls -la src/locales/generated/

	yarn cache clean
	npx nx reset
	VITE_BUILD_SOURCEMAP=false NODE_OPTIONS="--max-old-space-size=4096" yarn build



	echo "Building twenty-website package"
	cd ~/twenty/packages/twenty-website/
	yarn build

	echo "Building twenty-emails package"
	cd ~/twenty/packages/twenty-emails/
	yarn build

	echo "Building twenty-mcp-server package"
	cd ~/twenty/packages/twenty-mcp-server/
	npx nx run twenty-mcp-server:build || yarn build

