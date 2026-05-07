# Node Building Image
FROM node:20

# Install Python and required packages
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /opt/api

# Install app dependencies
COPY package*.json ./
COPY .sequelizerc ./
COPY .snyk ./

# Setup logging
RUN touch winston.log.json
RUN yarn cache clean

# Get environment argument passed in
ARG environment
ARG default_environment=development

# Set NODE_ENV environment variable
ENV NODE_ENV=${environment:-$default_environment}

# Install dependencies
RUN yarn install

# Create and activate Python virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install ML package in virtual environment
RUN pip3 install git+https://github.com/GSA/srt-ml.git@dev

# Bundle app source
COPY server/ ./server

# Get Login.gov Certs
COPY bin/copy_certs.sh ./
COPY certs/ ./certs
ARG LOGIN_PRIVATE_KEY
ENV LOGIN_PRIVATE_KEY=${LOGIN_PRIVATE_KEY}
RUN /opt/api/copy_certs.sh

# See https://docs.cloudfoundry.org/devguide/deploy-apps/push-docker.html
COPY docker/conf/passwd /etc/passwd

# Expose port
EXPOSE 8080

# Start app
CMD [ "node", "server/server.js" ]