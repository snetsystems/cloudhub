#!/bin/bash

DATA_DIR=/var/lib/csh

# create user
if ! id snet >/dev/null 2>&1; then
    useradd --system -U -M snet -s /opt/csh -d $DATA_DIR
fi