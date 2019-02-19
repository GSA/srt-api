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


function log() {
  echo "${@}" | tee -a ${LOG_FILE}
  echo | tee -a ${LOG_FILE}

}

function runline() {
  log "Executing:" $@
  $@ | tee -a ${LOG_FILE}
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


while [[ $# -gt 0 ]]
do
key="$1"

#    .arguments('<space> <tag>')
#    .option('-v', 'Verbose')
#    .option('-d, --dry-run', 'Do everything we can without deployment.')
#    .option('-s, --serverrepo <serverrepo>', 'URI pointing to the srt-server repository')
#    .option('-c, --clientrepo <clientrepo>', 'URI pointing to the srt-client repository')
#    .option('-t, --tempdir <tempdir>', 'Directory to use when cloning the SRT repositories')
#    .option('-y, --yes', 'Choose defaults with no prompting')
#    .action( async (space, tag) => {


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
    exit
fi

echo "Starting deployment." | tee ${LOG_FILE}
echo "Date/Time: ${TIME_STR}" | tee ${LOG_FILE}
echo "Current directory: ${CWD}"| tee ${LOG_FILE}
echo "$0 $@" | tee ${LOG_FILE}| tee ${LOG_FILE}
echo "" | tee ${LOG_FILE}| tee ${LOG_FILE}


echo SPACE           = "${SPACE}"| tee ${LOG_FILE}
echo TAG             = "${TAG}"| tee ${LOG_FILE}

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



#
# Clone the repos
#

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
runline "git fetch origin"

#
# create tag tag
#
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


#
# checkout the correct tag
#
changedir "${TEMP_DIR}/srt-client"
runline git checkout ${TAG} 2>&1
changedir "${TEMP_DIR}/srt-server"
runline git checkout ${TAG} 2>&1


#
# Build/prep client
#
changedir "${TEMP_DIR}/srt-client"
runline npm install --loglevel=error
runline ng build
changedir "${TEMP_DIR}/srt-client/dist"
runline touch Staticfile
log "Writing version info to ${TEMP_DIR}/srt-client/dist/version.html"
echo "${VERSION_INFO}" >  "${TEMP_DIR}/srt-client/dist/version.html"
runline echo "DONE CLIENT BUILD"


#
# Build/prep server
#
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
runline echo "DONE CLIENT BUILD"

if [[ $DRYRUN = "true" ]]; then
    runline echo
    runline echo
    runline echo "This is a dry run. Not deploying."
    runline echo
    exit
fi

changedir "${TEMP_DIR}/srt-client/dist"
runline ${CF_CLI} push -m 64M srt-client-${SPACE}
changedir "${TEMP_DIR}/srt-server"
runline ${CF_CLI} push srt-server-${SPACE}
