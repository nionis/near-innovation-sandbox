#!/bin/bash

# Check if the correct number of arguments is provided
if [ "$#" -ne 2 ]; then
    echo "Usage: $0 <path_to_json_input_file> <channel>"
    exit 1
fi

INPUT_JSON_FILE="$1"

CHANNEL="$2"

if [ "$CHANNEL" == "nightly" ]; then
    UPDATER="latest"
else
    UPDATER="beta"
fi

# Check if the input file exists
if [ ! -f "$INPUT_JSON_FILE" ]; then
    echo "Input file not found: $INPUT_JSON_FILE"
    exit 1
fi

# Use jq to transform the content
jq --arg channel "$CHANNEL" --arg updater "$UPDATER" '
    .name = "attestai-\($channel)" |
    .productName = "AttestAI-\($channel)" |
    .build.appId = "attestai-\($channel).app" |
    .build.productName = "AttestAI-\($channel)" |
    .build.appId = "attestai-\($channel).app" |
    .build.protocols[0].name = "AttestAI-\($channel)" |
    .build.protocols[0].schemes = ["attestai-\($channel)"] |
    .build.artifactName = "attestai-\($channel)-${os}-${arch}-${version}.${ext}" |
    .build.publish[0].channel = $updater
' "$INPUT_JSON_FILE" > ./package.json.tmp

cat ./package.json.tmp

rm $INPUT_JSON_FILE
mv ./package.json.tmp $INPUT_JSON_FILE

# Update the layout file
LAYOUT_FILE_PATH="apps/attest-app/web-app/app/layout.tsx"

if [ -f "$LAYOUT_FILE_PATH" ]; then
    # Perform the replacements
    sed -i -e "s#AttestAI#AttestAI-$CHANNEL#g" "$LAYOUT_FILE_PATH"
    echo "File has been updated: $LAYOUT_FILE_PATH"
else
    echo "Layout file not found (optional): $LAYOUT_FILE_PATH"
fi

# Notify completion
echo "Package.json has been updated"
