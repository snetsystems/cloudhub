#!/bin/bash

BIN_DIR=/usr/bin
DATA_DIR=/var/lib/csh
LOG_DIR=/var/log/csh
SCRIPT_DIR=/usr/lib/csh/scripts
LOGROTATE_DIR=/etc/logrotate.d

function install_init {
    cp -f $SCRIPT_DIR/init.sh /etc/init.d/csh
    chmod +x /etc/init.d/csh
}

function install_systemd {
    # Remove any existing symlinks
    rm -f /etc/systemd/system/csh.service

    cp -f $SCRIPT_DIR/csh.service /lib/systemd/system/csh.service
    systemctl enable csh || true
    systemctl daemon-reload || true
}

function install_update_rcd {
    update-rc.d csh defaults
}

function install_chkconfig {
    chkconfig --add csh
}

# Remove legacy symlink, if it exists
if [[ -L /etc/init.d/csh ]]; then
    rm -f /etc/init.d/csh
fi

# Add defaults file, if it doesn't exist
if [[ ! -f /etc/default/csh ]]; then
    touch /etc/default/csh
fi

# Distribution-specific logic
if [[ -f /etc/redhat-release ]]; then
    # RHEL-variant logic
    which systemctl &>/dev/null
    if [[ $? -eq 0 ]]; then
    	install_systemd
    else
    	# Assuming sysv
    	install_init
    	install_chkconfig
    fi
elif [[ -f /etc/debian_version ]]; then
    # Debian/Ubuntu logic

    # Ownership for RH-based platforms is set in build.py via the `rmp-attr` option.
    # We perform ownership change only for Debian-based systems.
    # Moving these lines out of this if statement would make `rmp -V` fail after installation.
    test -d $LOG_DIR || mkdir -p $DATA_DIR
    test -d $DATA_DIR || mkdir -p $DATA_DIR
    chown -R -L snet:snet $LOG_DIR
    chown -R -L snet:snet $DATA_DIR
    chmod 755 $LOG_DIR
    chmod 755 $DATA_DIR

    which systemctl &>/dev/null
    if [[ $? -eq 0 ]]; then
    	install_systemd
        systemctl restart csh || echo "WARNING: systemd not running."
    else
    	# Assuming sysv
    	install_init
    	install_update_rcd
        invoke-rc.d csh restart
    fi
elif [[ -f /etc/os-release ]]; then
    source /etc/os-release
    if [[ $ID = "amzn" ]]; then
    	# Amazon Linux logic
    	install_init
    	install_chkconfig
    fi
fi