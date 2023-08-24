#!/bin/bash

# Install packages if not one your system (check for linux or mac)
# Install npm based on if it is mac or linux
if [uname -a | grep -q "Darwin"]; then
    # Mac
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/master/install.sh)"
    echo "Installing npm..."
    brew install npm

    echo "Installing postgres..."
    brew install postgresql

    echo "Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash

else
    # Linux
    echo "Installing npm..."
    sudo apt-get install npm
  
    echo "Installing postgres..."
    sudo apt-get install postgresql postgresql-contrib libpq-dev

    echo "Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
fi



# Create circleci User in postgresql
sudo -u postgres psql -c "CREATE USER circleci WITH PASSWORD 'srtpass';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO circleci;"
sudo -u postgres psql -c "ALTER USER circleci WITH Superuser;"
sudo -u postgres psql -c "ALTER USER circleci WITH CREATEROLE;"
sudo -u postgres psql -c "ALTER USER circleci WITH CREATEDB;"

# Create srt database
createdb srt -O circleci

# Navigate to srt-api directory
cd ..
psql -d srt -f db/init/tables.sql


# Install node 16 with nvm
nvm install 16
nvm use 16

# Install node modules
npm install