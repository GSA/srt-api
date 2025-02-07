# Node Building Image
FROM node:20

# Install Python and pip
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    git \
    && rm -rf /var/lib/apt/lists/*

# create app directory
WORKDIR /opt/api

# install app dependencies
COPY package*.json ./
COPY .sequelizerc ./
COPY .snyk ./

# Running it locally you need to set the JWT_SECRET environment variable: 
# ENV JWT_SECRET=abc123
RUN touch winston.log.json
RUN yarn cache clean

# Get environment argument passed in
ARG environment
ARG default_environment=development

# Set NODE_ENV environment variable
ENV NODE_ENV=${environment:-$default_environment}

# Set SNYK TOKEN environment variable
ARG SNYK_TOKEN
ENV SNYK_TOKEN=${SNYK_TOKEN}
RUN yarn global add snyk@latest
RUN snyk auth "$SNYK_TOKEN"

# Check environment and install dependencies
# Note: When the NODE_ENV environment variable is set to 'production' npm 
#       will not install modules listed in devDependencies
# Reference: https://docs.npmjs.com/cli/v8/commands/npm-install
RUN yarn install

# Clone SRT ML repo and install requirements
RUN git clone --branch dev https://github.com/GSA/srt-ml.git /opt/ml
WORKDIR /opt/ml
COPY src/srt_ml/predict/analyze_text.py /opt/ml/src/srt_ml/predict/analyze_text.py
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip3 install -r requirements.txt
WORKDIR /opt/api

# Bundle app source
COPY server/ ./server

# Get Login.gov Certs
COPY bin/copy_certs.sh ./
COPY certs/ ./certs
ARG LOGIN_PRIVATE_KEY
ENV LOGIN_PRIVATE_KEY=${LOGIN_PRIVATE_KEY}
RUN /opt/api/copy_certs.sh

#see https://docs.cloudfoundry.org/devguide/deploy-apps/push-docker.html
COPY docker/conf/passwd /etc/passwd

# expose port
EXPOSE 8080

# start app
CMD [ "node", "server/server.js" ]