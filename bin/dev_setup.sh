#!/bin/bash

# Install packages if not one your system (check for linux or mac)
# Install npm based on if it is mac or linux
if [uname -a | grep -q "Darwin"]; then
    echo "Detected Mac OS"

    # Mac
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
    echo "Installing npm..."
    brew install npm

    echo "Installing postgres..."
    brew install postgresql

    echo "Installing nvm..."
    brew install nvm

    mkdir ~/.nvm 

    echo 'export NVM_DIR="$HOME/.nvm"' >> ~/.bash_profile
    echo '[ -s "/usr/local/opt/nvm/nvm.sh" ] && \. "/usr/local/opt/nvm/nvm.sh"' >> ~/.bash_profile
    echo '[ -s "/usr/local/opt/nvm/etc/bash_completion" ] && \. "/usr/local/opt/nvm/etc/bash_completion"' >> ~/.bash_profile
    
    source ~/.bash_profile 
    

    # Make Sure Postgres is started
    echo "Starting postgres..."
    pg_ctl start

else
    echo "Detected Ubuntu"

    # Ubuntu
    echo "Installing npm..."
    sudo apt-get install npm
  
    echo "Installing postgres..."
    sudo apt-get install postgresql postgresql-contrib libpq-dev

    echo "Installing curl..."
    sudo apt-get install curl

    echo "Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash

    source ~/.bashrc 

    # Make Sure Postgres is started
    echo "Starting postgres..."
    sudo systemctl start postgresql.service
    
fi



# Create circleci User in postgresql
sudo -u postgres createuser circleci
sudo -u postgres psql -c "ALTER USER circleci WITH password 'srtpass';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO circleci;"
sudo -u postgres psql -c "ALTER USER circleci WITH Superuser;"
sudo -u postgres psql -c "ALTER USER circleci WITH CREATEROLE;"
sudo -u postgres psql -c "ALTER USER circleci WITH CREATEDB;"

sudo -u postgres createuser $USER
sudo -u postgres psql -c "ALTER USER $USER WITH Superuser;"
sudo -u postgres psql -c "ALTER USER $USER WITH CREATEDB;"


# Create srt database
echo "Creating srt database..."
sudo -u postgres createdb srt -O circleci

# Navigate to srt-api directory
echo "Navigating to srt-api directory..."
psql -d srt -f ../db/init/tables.sql


# Install node 16 with nvm
echo "Installing node 16..."
nvm install 16
nvm use 16

# Need snyk auth for npm install
echo "Installing snyk..."
npm install snyk -g

echo "Authenticating snyk..."
snyk auth

# Install node modules
echo "Installing node modules..."
cd ..
npm install

echo "Start API Server by running 'npm run dev'"
