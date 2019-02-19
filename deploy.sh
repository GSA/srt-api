#!/bin/bash

POSITIONAL=()
TEMP_DIR="/tmp"
SERVER_REPO="http://acrowley:***REMOVED***@gitlab.tcg.com/SRT/srt-server.git"
CLIENT_REPO="http://acrowley:***REMOVED***@gitlab.tcg.com/SRT/srt-client.git"
TIME_STR=`date +%Y-%m-%d.%H.%M.%S`
CWD=`pwd`
RECLONE=true
LOG_FILE="${CWD}/deploy-log-${TIME_STR}.log"
CF_CLI=cf


function read_args() {
    while [[ $# -gt 0 ]]
    do
        key="$1"

        case $key in
            -v|--verbose)
            VERBOSE=true
            shift # past argument
            ;;
            -d|--dry-run)
            DRYRUN=true
            shift # past value
            ;;
            -s|--serverrepo)
            SERVER_REPO="$2"
            shift # past argument
            shift # past value
            ;;
            -c|--clientrepo)
            CLIENT_REPO="$2"
            shift # past argument
            shift # past value
            ;;
            -t|--tempdir)
            TEMP_DIR="$2"
            shift # past argument
            shift # past value
            ;;
            -y|--yes)
            YES=true
            shift # past argument
            ;;
            -n|--no)
            RECLONE=false
            shift # past argument
            ;;
            -b|--create-tag-from-branch)
            BRANCH="$2"
            CREATE_TAG=true
            shift # past argument
            shift # past value
            ;;
            *)    # unknown option
            POSITIONAL+=("$1") # save it in an array for later
            shift # past argument
            ;;
        esac
    done

    SPACE=${POSITIONAL[0]}
    TAG=${POSITIONAL[1]}
    VERSION_INFO="{ \"version\" : \"${TAG}\" , \"build_date\" : \"${TIME_STR}\" } "

    if [[ "${TAG}" = "" ]]; then
        help
        exit
    fi
}

function log() {
  echo "${@}" | tee -a ${LOG_FILE}
  echo | tee -a ${LOG_FILE}

}

function runline() {
  log "Executing:" $@
  $@ 2>&1 | tee -a ${LOG_FILE}
  RESULT=${PIPESTATUS[0]}
  if [[ "${RESULT}" -ne "0" ]]; then
    echo "" | tee  -a ${LOG_FILE}
    echo "" | tee  -a ${LOG_FILE}
    echo "COMMAND FAILED WITH EXIT CODE ${RESULT}." | tee  -a ${LOG_FILE}
    exit
  fi
  log ""
}

function changedir() {
    echo "Executing: cd ${1}" | tee -a ${LOG_FILE}
    cd $1
    RESULT=${PIPESTATUS[0]}
    if [[ "${RESULT}" -ne "0" ]]; then
       echo "" | tee  -a ${LOG_FILE}
       echo "" | tee  -a ${LOG_FILE}
       echo "COMMAND FAILED WITH EXIT CODE ${RESULT}." | tee  -a ${LOG_FILE}
       exit
    fi
    echo | tee -a ${LOG_FILE}
    echo | tee -a ${LOG_FILE}
}

# Check if the SENDGRID_API_KEY is set
# set it if necessary
function check_cloud_gov_env() {
    if [[ `cf env srt-server-${SPACE} | grep SENDGRID_API_KEY | wc -l` -lt 1 ]]; then
      log "The SENDGRID_API_KEY environment variable is not set on srt-server-${SPACE}"
      log "You must set that variable to allow outgoing email."
      log ""
      log ""
      log "CLI command:"
      log "cf set-env srt-server-${SPACE} SENDGRID_API_KEY [key]"
      log ""
      log "You can see current environment settings with: "
      log "cf env srt-server-${SPACE}"
      log ""
      while true; do
        read -p "Would you like to enter the key now?" yn
        case $yn in
            [Yy]* )
              log "yes chosen"
              read -p "key: " key
              runline ${CF_CLI} set-env "srt-server-${SPACE}" SENDGRID_API_KEY ${key}
              runline ${CF_CLI} restage "srt-server-${SPACE}"
              break;;
            [Nn]* ) log "no chosen."; break;;
            * ) log "Please answer yes or no.";;
        esac
      done
    fi
}

function help() {
    echo "You must provide a SPACE and a TAG"
    echo
    echo "usage: deploy.sh [OPTIONS] <SPACE> <TAG>"
    echo ""
    echo "    -d --dry-run : do everything but push to cloud.gov"
    echo "    -s --serverrepo : URI for srt-server repository"
    echo "    -c --clientrepo : URI for srt-client repository"
    echo "    -t --tempdir : defaults to /tmp"
    echo "    -y --yes : deleting existing git repo in temp directory"
    echo "    -b --create-tag-from-branch : Create TAG at head of this branch"
    echo ""
    echo ""
}

function switch_space() {
    log "Switching to space ${SPACEE} on cloud.gov"
    log "Executing: ${CF_CLI} target -s ${SPACE}"
    ${CF_CLI} target -s ${SPACE}
    RESULT=${PIPESTATUS[0]}
    if [[ "${RESULT}" -ne "0" ]]; then
        echo "" | tee  -a ${LOG_FILE}
        echo "" | tee  -a ${LOG_FILE}
        echo "CLOUD.GOV CLI COMMAND FAILED WITH EXIT CODE ${RESULT}." | tee  -a ${LOG_FILE}
        echo "" | tee  -a ${LOG_FILE}
        echo "If you are not logged into cloud.gov use the command:" | tee  -a ${LOG_FILE}
        echo "cf login -u [email] -o gsa-ogp-srt -a api.fr.cloud.gov --sso" | tee  -a ${LOG_FILE}
        echo "" | tee  -a ${LOG_FILE}
        exit
    fi
}

function setup_repositories() {
    changedir ${TEMP_DIR}

    if [[ "${YES}" = "true" ]]; then
      runline "rm -rf srt-server"
      runline "rm -rf srt-client"
    fi

    if [[ "${RECLONE}" = "true" ]]; then
        if [ -d "${TEMP_DIR}/srt-client" ]; then
            while true; do
                read -p "${TEMP_DIR}/srt-client exists. Delete and re-clone?" yn
                case $yn in
                    [Yy]* ) rm -rf "${TEMP_DIR}/srt-client"; break;;
                    [Nn]* ) break;;
                    * ) echo "Please answer yes or no.";;
                esac
            done
        fi
    fi

    if [ ! -d "${TEMP_DIR}/srt-client" ]; then
        runline "git clone ${CLIENT_REPO}"
        runline chmod 777 "${TEMP_DIR}/srt-client"
    fi
    changedir "${TEMP_DIR}/srt-client"
    runline "git reset --hard"
    runline "git fetch origin"


    changedir ${TEMP_DIR}
    if [[ "${RECLONE}" = "true" ]]; then
        if [ -d "${TEMP_DIR}/srt-server" ]; then
            while true; do
                read -p "${TEMP_DIR}/srt-server exists. Delete and re-clone?" yn
                case $yn in
                    [Yy]* ) rm -rf "${TEMP_DIR}/srt-server"; break;;
                    [Nn]* ) break;;
                    * ) echo "Please answer yes or no.";;
                esac
            done
        fi
    fi

    if [ ! -d "${TEMP_DIR}/srt-server" ]; then
        runline "git clone ${SERVER_REPO}"
        runline chmod 777 "${TEMP_DIR}/srt-server"
    fi
    changedir "${TEMP_DIR}/srt-server"
    runline "git reset --hard"
    runline "git fetch origin"

}

function checkout_tag() {
    # create the tag if requested
    if [[ "${CREATE_TAG}" == "true" ]]; then
        changedir "${TEMP_DIR}/srt-client"
        runline "git checkout ${BRANCH}"
        log git tag -a ${TAG} -m "baseline tag created for deployment"
        git tag -a ${TAG} -m "baseline tag created for deployment" || exit
        runline "git push origin ${TAG}"

        changedir "${TEMP_DIR}/srt-server"
        runline git checkout ${BRANCH}
        log git tag -a ${TAG} -m "baseline tag created for deployment"
        git tag -a ${TAG} -m "baseline tag created for deployment" || exit
        runline git push origin ${TAG}
    fi

    # checkout the correct tag
    changedir "${TEMP_DIR}/srt-client"
    runline git checkout ${TAG} 2>&1
    changedir "${TEMP_DIR}/srt-server"
    runline git checkout ${TAG} 2>&1
}

function build_client() {
    changedir "${TEMP_DIR}/srt-client"
    runline npm install --loglevel=error
    runline ng build --env=prod
    changedir "${TEMP_DIR}/srt-client/dist"
    runline touch Staticfile
    log "Writing version info to ${TEMP_DIR}/srt-client/dist/version.html"
    echo "${VERSION_INFO}" >  "${TEMP_DIR}/srt-client/dist/version.html"
    log "DONE CLIENT BUILD"
}

function build_server() {
    changedir "${TEMP_DIR}/srt-server"
    # verify we have a config file for $SPACE
    if [[ ! -f "manifest.${SPACE}.yml" ]]; then
      runline echo "No manifest file for ${SPACE} found. Expected srt-server/manifest.${SPACE}.yml"
      exit
    fi
    runline rm -f "${TEMP_DIR}/srt-server/manifest.yml"
    runline cp "manifest.${SPACE}.yml" manifest.yml
    log "Writing version info to ${TEMP_DIR}/srt-server/server/version.json"
    echo "${VERSION_INFO}" >  "${TEMP_DIR}/srt-server/server/version.json"
    log "DONE CLIENT BUILD"
}

function check_dryrun() {
    if [[ $DRYRUN = "true" ]]; then
        runline echo
        runline echo
        runline echo "This is a dry run. Not deploying."
        runline echo
        exit
    fi
}

function deploy_client(){
    changedir "${TEMP_DIR}/srt-client/dist"
    runline ${CF_CLI} push -m 64M srt-client-${SPACE}
}

function deploy_server() {
    changedir "${TEMP_DIR}/srt-server"
    runline ${CF_CLI} push srt-server-${SPACE}
}

read_args "$@"

echo "Starting deployment." | tee ${LOG_FILE}
echo "Date/Time: ${TIME_STR}" | tee ${LOG_FILE}
echo "Current directory: ${CWD}"| tee ${LOG_FILE}
echo "$0 $@" | tee ${LOG_FILE}| tee ${LOG_FILE}
echo "" | tee ${LOG_FILE}| tee ${LOG_FILE}
echo SPACE           = "${SPACE}"| tee ${LOG_FILE}
echo TAG             = "${TAG}"| tee ${LOG_FILE}

switch_space

setup_repositories

checkout_tag

build_client
build_server

# check if this is a dry run. Will exit here if it is.
check_dryrun

deploy_client
deploy_server

check_cloud_gov_env

log "Deployment complete"

#
# Don't use these yet, but we could use them to auto-route if necessary later.
#
#
#   # create a new route "srt-server" in the dev space
#   cf create-route dev app.cloud.gov --hostname srt-server
#   # map the srt-server route to the srt-server-dev app
#   cf map-route srt-server-dev app.cloud.gov --hostname srt-server
