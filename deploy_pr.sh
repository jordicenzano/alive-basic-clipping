#!/usr/bin/env bash

#Remeber you can select the Alive env in the URL QS
aws s3 sync . s3://alive-pr-brain-ui/alive-test/clipV2 --exclude ".*" --exclude "*.sh"
