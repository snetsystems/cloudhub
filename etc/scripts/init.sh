#!/bin/bash
# If you modify this, please make sure to also edit cloudhub.service

# Script to execute when starting
SCRIPT="/usr/bin/cloudhub"
export HOST="0.0.0.0"
export PORT="8888"
#export PORT="443"
#export TLS_CERTIFICATE="/usr/lib/cloudhub/key/cloudhub_self_signed.pem"
export BOLT_PATH="/var/lib/cloudhub/cloudhub-v1.db"
export CANNED_PATH="/usr/share/cloudhub/cloudhub-canned"
export PROTOBOARDS_PATH="/usr/share/cloudhub/cloudhub-protoboards"
export TEMPLATES_PATH="/usr/share/cloudhub/cloudhub-templates"

# Options to pass to the script on startup
. /etc/default/cloudhub
SCRIPT_OPTS=${CLOUDHUB_OPTS}

# User to run the process under
RUNAS=snet

# PID file for process
PIDFILE=cloudhub

# Where to redirect logging to
LOGFILE=/var/log/cloudhub/cloudhub.log

start() {   
    if [[ -f $PIDFILE ]]; then
        # PIDFILE exists
        if kill -0 $(cat $PIDFILE) &>/dev/null; then
            # PID up, service running
            echo '[OK] Service already running.' >&2
            return 0
        fi
    fi

    local CMD="$SCRIPT $SCRIPT_OPTS 1>>\"$LOGFILE\" 2>&1 & echo \$!"
    su -s /bin/sh -c "$CMD" $RUNAS > "$PIDFILE"
    
    if [[ -f $PIDFILE ]]; then
        # PIDFILE exists
        if kill -0 $(cat $PIDFILE) &>/dev/null; then
            # PID up, service running
            echo '[OK] Service successfully started.' >&2
            return 0
        fi
    fi
    echo '[ERROR] Could not start service.' >&2
    return 1
}

status() {
    if [[ -f $PIDFILE ]]; then
        # PIDFILE exists
        if ps -p $(cat $PIDFILE) &>/dev/null; then
            # PID up, service running
            echo '[OK] Service running.' >&2
            return 0
        fi
    fi
    echo '[ERROR] Service not running.' >&2
    return 1
}

stop() {
    if [[ -f $PIDFILE ]]; then
        # PIDFILE still exists
        if kill -0 $(cat $PIDFILE) &>/dev/null; then
            # PID still up
            kill -15 $(cat $PIDFILE) &>/dev/null && rm -f "$PIDFILE" &>/dev/null
            if [[ "$?" = "0" ]]; then
                # Successful stop
                echo '[OK] Service stopped.' >&2
                return 0
            else
                # Unsuccessful stop
                echo '[ERROR] Could not stop service.' >&2
                return 1
            fi
        fi
    fi
    echo "[OK] Service already stopped."
    return 0
}

case "$1" in
    start)
        if [[ "$UID" != "0" ]]; then
            echo "[ERROR] Permission denied."
            exit 1
        fi
        start
        ;;
    status)
        status
        ;;
    stop)
        if [[ "$UID" != "0" ]]; then
            echo "[ERROR] Permission denied."
            exit 1
        fi
        stop
        ;;
    restart)
        stop
        start
        ;;
    *)
        echo "Usage: $0 {start|status|stop|restart}"
        esac