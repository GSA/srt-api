# Manual Setup Guide 
Use the following as a guide to install required modules when the automated setup script fails or is not available. 

## Install Docker 
Install the Docker engine for various platforms by referring to the documentation here: [https://docs.docker.com/engine/install/]

## Install Node Package Manager (npm)
Mac: 
```
brew install npm
```

Ubuntu: 
```
sudo apt-get install -y nodejs npm
sudo npm install npm@latest -g
```

## Install Postgres 
Mac: 
```
brew install postgresql
```

Ubuntu: 
```
sudo apt install postgresql-client libpq-dev postgresql-server-dev pgadmin
```

## Install Node Version Manager (nvm)
Mac: 
```
brew install nvm

mkdir ~/.nvm 

echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.bash_profile
echo '[ -s "/usr/local/opt/nvm/nvm.sh" ] && \. "/usr/local/opt/nvm/nvm.sh"' >> ~/.bash_profile
echo '[ -s "/usr/local/opt/nvm/etc/bash_completion" ] && \. "/usr/local/opt/nvm/etc/bash_completion"' >> ~/.bash_profile

source ~/.bash_profile 
```
Ubuntu: 
```
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash

source ~/.bashrc 
```
## Download SRT Source Code 
For both Mac and Ubuntu: 
* Navigate to the desired folder to clone the srt-api project. 
* Then execute the following in the command line: 
```
git clone https://github.com/GSA/srt-api.git
cd srt-api
git checkout dev
npm install
```
* Next navigate to the desired folder to clone the srt-ui project. 
* Then execute the following in the command line: 
```
git clone https://github.com/GSA/srt-ui.git
cd srt-ui
git checkout dev
npm install
```
## Set Environment Variables 
* Set the following environment variables: 
```
echo export NODE_ENV=development >> ~/.bashrc
echo export PGHOST=localhost >> ~/.bashrc
echo export PGDATABASE=srt >> ~/.bashrc
echo export PGUSER=circleci >> ~/.bashrc
echo export PGPASSWORD=srtpass >> ~/.bashrc
source ~/.bashrc
```

## Start Postgres 
Mac: 
```
pg_ctl start
```
Ubuntu: 
```
sudo systemctl start postgresql.service
```
## Final Steps 
For both Mac and Ubuntu: 
### Create Postgres user 
```
sudo -u postgres createuser circleci
sudo -u postgres psql -c "ALTER USER circleci WITH password 'srtpass';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO circleci;"
sudo -u postgres psql -c "ALTER USER circleci WITH Superuser;"
sudo -u postgres psql -c "ALTER USER circleci WITH CREATEROLE;"
sudo -u postgres psql -c "ALTER USER circleci WITH CREATEDB;"

sudo -u postgres createuser $USER
sudo -u postgres psql -c "ALTER USER $USER WITH Superuser;"
sudo -u postgres psql -c "ALTER USER $USER WITH CREATEDB;"
```
### Create the SRT database 
```
echo "Creating the srt database..."
sudo -u postgres createdb srt -O circleci
```
### Create tables 
```
echo "Creating the srt tables..."
psql -d srt -f ../db/init/tables.sql
```
### Install Node Version 16 
```
echo "Installing node 16..."
nvm install 16

echo "Set the environment to use version 16..."
nvm use 16
```
### Install SNYK 
* During this installation you will be redirected to the SNYK website. 
* Complete your authentication at SNYK before proceeding to the next step. 
```
echo "Installing snyk..."
npm install snyk -g

echo "Authenticating snyk..."
snyk auth
```
### Install Node modules 
* Navigate back to the top level of your srt-api folder 
```
echo "Installing node modules..."
npm install
```
### Start the Server 
```
echo "Starting the server..."
npm run start
```