#!/bin/bash

function disable_systemd {
    systemctl disable cloudhub
    rm -f /lib/systemd/system/cloudhub.service
}

function disable_update_rcd {
    update-rc.d -f cloudhub remove
    rm -f /etc/init.d/cloudhub
}

function disable_chkconfig {
    chkconfig --del cloudhub
    rm -f /etc/init.d/cloudhub
}

if [[ -f /etc/redhat-release ]]; then
    # RHEL-variant logic
    if [[ "$1" = "0" ]]; then
	# cloudhub is no longer installed, remove from init system
	rm -f /etc/default/cloudhub
	
	which systemctl &>/dev/null
	if [[ $? -eq 0 ]]; then
	    disable_systemd
	else
	    # Assuming sysv
	    disable_chkconfig
	fi
    fi
elif [[ -f /etc/lsb-release ]]; then
    # Debian/Ubuntu logic
    if [[ "$1" != "upgrade" ]]; then
	# Remove/purge
	rm -f /etc/default/cloudhub
	
	which systemctl &>/dev/null
	if [[ $? -eq 0 ]]; then
	    disable_systemd
	else
	    # Assuming sysv
	    disable_update_rcd
	fi
    fi
elif [[ -f /etc/os-release ]]; then
    source /etc/os-release
    if [[ $ID = "amzn" ]]; then
	# Amazon Linux logic
	if [[ "$1" = "0" ]]; then
	    # cloudhub is no longer installed, remove from init system
	    rm -f /etc/default/cloudhub
	    disable_chkconfig
	fi
    fi
fi