#!/bin/bash

DATA_DIR=/var/lib/cloudhub

# create user
if ! id snet >/dev/null 2>&1; then
    useradd --system -U -M snet -s /bin/false -d $DATA_DIR
fi