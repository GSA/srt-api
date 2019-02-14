#!/bin/bash

POSITIONAL=()
TEMP_DIR="/tmp"
SERVER_REPO="http://acrowley:***REMOVED***@gitlab.tcg.com/SRT/srt-server.git"
CLIENT_REPO="http://acrowley:***REMOVED***@gitlab.tcg.com/SRT/srt-client.git"

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
    DEFAULT=YES
    YES=true
    shift # past argument
    ;;
    -b|--create-tag-from-branch)
    BRANCH="$2"
    CREATE_TAG=true
    shift # past argument
    ;;
    *)    # unknown option
    POSITIONAL+=("$1") # save it in an array for later
    shift # past argument
    ;;
esac
done

SPACE=${POSITIONAL[0]}
TAG=${POSITIONAL[1]}

echo SPACE           = "${SPACE}"
echo TAG             = "${TAG}"
echo VERBOSE         = "${VERBOSE}"

if [[ "${TAG}" = "" ]]; then
    echo "You must provide a SPACE and a TAG"
    exit
fi

cf target -s ${SPACE} || exit


#
# Clone the repos
#

cd ${TEMP_DIR}

if [[ "${YES}" = "" ]]; then
  rm -rf srt-server
  rm -rf srt-client
fi

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

if [ ! -d "${TEMP_DIR}/srt-client" ]; then
    git clone ${CLIENT_REPO} || exit
fi



cd ${TEMP_DIR}
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

if [ ! -d "${TEMP_DIR}/srt-server" ]; then
    git clone ${SERVER_REPO} || exit
fi

#
# create tag tag
#
if [[ "${CREATE_TAG}" == "true" ]]; then
    cd "${TEMP_DIR}/srt-client"
    git checkout ${BRANCH} || exit
    git tag -a ${TAG} -m "baseline tag created for deployment" || exit
    git push origin ${TAG} || exit

    cd "${TEMP_DIR}/srt-server"
    git checkout ${BRANCH} || exit
    git tag -a ${TAG} -m "baseline tag created for deployment" || exit
    git push origin ${TAG} || exit
fi


#
# checkout the correct tag
#
cd "${TEMP_DIR}/srt-client"
git checkout ${TAG} | grep "HEAD" || exit
cd "${TEMP_DIR}/srt-server"
git checkout ${TAG} | grep "HEAD" || exit

exit
#
# Build client
#
cd "${TEMP_DIR}/srt-client"
npm install || exit
# ng build || exit
cd dist
touch Staticfile

if [[ $DRYRUN = "true" ]]; then
    echo "This is a dry run. Not deploying."
else
    echo "We should deploy now"
fi

