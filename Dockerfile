# syntax=docker/dockerfile:1

FROM node:18-alpine
# https://www.cloudbees.com/blog/using-docker-compose-for-nodejs-development
# https://docs.docker.com/language/nodejs/build-images/

#ENV NODE_ENV=production

# Set the working directory to /app. This instructs Docker to use this path as the 
# default location for all subsequent commands. This way we do not have to type out 
# full file paths but can use relative paths based on the working directory.
WORKDIR /app

# Copy the package.json file to /app
COPY ["package.json", "package-lock.json*", "./"]

# Install node_modules
RUN npm install --quiet

# Copy all the files from the project's root to /app
# I.e. add our source code into the image.
COPY . .