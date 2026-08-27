# Node Building Image
FROM node:20

# Install Python and required packages
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    tesseract-ocr \
    tesseract-ocr-eng \
    poppler-utils \
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

# Deliberately yarn, NOT npm ci. yarn.lock exists here, so this build is already
# deterministic. npm ci additionally runs "git dep preparation" on the git-pinned
# @albertcrowley/winston-pg-native, which compiles its native libpq dependency
# from source — and that fails against Node 20 headers (Nan/v8 API drift).
# Switching to npm ci requires replacing that logger first.
RUN yarn install

# Create and activate Python virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install ML package in virtual environment
RUN pip3 install git+https://github.com/GSA/srt-ml.git@dev
RUN pip3 install stop-words joblib "scikit-learn>=1.8.0" scipy numpy

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