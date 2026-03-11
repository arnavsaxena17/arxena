# Branch: from BUILD_BRANCH env (passed by build_app_in_new_instance.sh) or build.config or default
[ -f ~/build.config ] && source ~/build.config
BUILD_BRANCH="${BUILD_BRANCH:-without-payment}"

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
        echo "Vite version: $(npx vite --version 2>/dev/null || echo 'not yet installed')"
        echo "Build environment setup complete!"
	export NODE_OPTIONS="--max-old-space-size=4096"
	source ~/.nvm/nvm.sh
	nvm install 22
	nvm use 22

	echo "Node version: $(node -v)"
	echo "npm version: $(npm -v)"
	echo "Nest CLI version: $(nest --version)"
	echo "Vite version: $(npx vite --version 2>/dev/null || echo 'not yet installed')"

	git clone https://github.com/arnavsaxena17/twenty.git
       	cd twenty
	mv ~/.env_server ~/twenty/packages/twenty-server/.env
        mv ~/.env_front ~/twenty/packages/twenty-front/.env
	if [ -f ~/.env_website ]; then
	  mv ~/.env_website ~/twenty/packages/twenty-website/.env
	else
	  cp ~/twenty/packages/twenty-website/.env.example ~/twenty/packages/twenty-website/.env
	fi

	git checkout "${BUILD_BRANCH:-without-payment}"
      	# Branch set by build_app_in_new_instance.sh via BUILD_BRANCH env
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
	yarn build --no-lint

	echo "Building twenty-emails package"
	cd ~/twenty/packages/twenty-emails/
	yarn build

	echo "Building twenty-mcp-server package"
	cd ~/twenty/packages/twenty-mcp-server/
	npx nx run twenty-mcp-server:build || yarn build
