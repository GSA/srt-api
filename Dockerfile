## Node Building Image
FROM node:16

# create app directory
WORKDIR /opt/api

# install app dependencies
COPY package*.json ./
COPY .sequelizerc ./
COPY .snyk ./

# Running it locally you need to set the JWT_SECRET environment variable: 
# ENV JWT_SECRET=abc123

RUN touch winston.log.json

RUN npm cache clean --force

# Get environment argument passed in
ARG environment
ARG default_environment=development

# Set NODE_ENV environment variable
ENV NODE_ENV=${environment:-$default_environment}

# Set SNYK TOKEN environment variable
ARG SNYK_TOKEN
ENV SNYK_TOKEN ${SNYK_TOKEN}
RUN npm install snyk@latest -g
RUN snyk auth ${SNYK_TOKEN}


# Check environment and install dependencies
# Note: When the NODE_ENV environment variable is set to 'production' npm 
#       will not install modules listed in devDependencies
# Reference: https://docs.npmjs.com/cli/v8/commands/npm-install
RUN npm install

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