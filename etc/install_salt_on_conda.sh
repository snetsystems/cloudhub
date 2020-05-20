#!/bin/sh -

conda_install() {
    ### sh Download & Install
    curl -o $PREFIX/miniconda3.sh https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh;
    bash $PREFIX/miniconda3.sh -b -u -p $PREFIX

    echo ". $PREFIX/etc/profile.d/conda.sh" >> ~/.bashrc
    source ~/.bashrc > /dev/null 2>&1
    source $PREFIX/etc/profile.d/conda.sh

    yum install -y gcc

    ### Create Env
    conda create -y -n saltenv python=3.7
    conda activate saltenv
    conda env list

    ### conda install
    conda update pip
    # conda install -y -c anaconda gcc
    conda install -y -c anaconda pycrypto

    ### salt-minion install
    yes w | pip install pyzmq PyYAML msgpack-python jinja2 futures tornado
    yes w | pip install salt==2019.2.5

    ### create salt-minion config
    DIR=$PREFIX/etc/salt
    if [ ! -d $DIR ]; then
        mkdir -p $DIR > /dev/null 2>&1
    fi
    echo "# Set the location of the salt master server. If the master server cannot be
    # resolved, then the minion will fail to start.
    master: $MASTER
    id: $MINION
    # The directory to store the pki information in
    root_dir: $PREFIX/
    #file_roots:
    #  base:
    #    - $PREFIX/srv/salt/prod" > $PREFIX/etc/salt/minion

    ### create logrotate.d
    echo "$PREFIX/var/log/salt/minion {
        rotate 6
        daily
        missingok
        dateext
        copytruncate
        notifempty
        compress
    }" > /etc/logrotate.d/snet-salt

    if [ "$MASTER_INSTALL" == "y" ]; then
        DIR=$PREFIX/etc/salt/master.d
        if [ ! -d $DIR ]; then
            mkdir -p $DIR > /dev/null 2>&1
        fi

        yes w | pip install CherryPy

        ### create salt-master service
        echo "[Unit]
        Description=The Salt Master
        After=network.target

        [Service]
        KillMode=process
        Type=notify
        NotifyAccess=all
        LimitNOFILE=100000
        ExecStart=$PREFIX/envs/saltenv/bin/salt-master -c '$PREFIX/etc/salt'

        [Install]
        WantedBy=multi-user.target" > /usr/lib/systemd/system/snet-salt-master.service
        systemctl enable snet-salt-master.service > /dev/null 2>&1
        echo "Create Success snet-salt-master.service"

        ### create salt-api service
        echo "[Unit]
        Description=The Salt API
        After=network.target

        [Service]
        KillMode=process
        Type=notify
        NotifyAccess=all
        LimitNOFILE=8192
        ExecStart=$PREFIX/envs/saltenv/bin/salt-api -c '$PREFIX/etc/salt'

        [Install]
        WantedBy=multi-user.target" > /usr/lib/systemd/system/snet-salt-api.service
        systemctl enable snet-salt-api.service > /dev/null 2>&1
        echo "Create Success snet-salt-api.service"
        echo "You need start 'snet-salt-master.service', 'snet-salt-api.service'"
        echo "--------------------------------------------------"
    fi
    
    ### create salt-minion service
    echo "[Unit]
    Description=The Salt Minion
    After=network.target

    [Service]
    KillMode=process
    Type=notify
    NotifyAccess=all
    LimitNOFILE=8192
    ExecStart=$PREFIX/envs/saltenv/bin/salt-minion -c '$PREFIX/etc/salt'

    [Install]
    WantedBy=multi-user.target" > /usr/lib/systemd/system/snet-salt-minion.service
    systemctl daemon-reload > /dev/null 2>&1
    systemctl enable snet-salt-minion.service > /dev/null 2>&1
    echo "Create Success snet-salt-minion.service"
    echo "Install Complete!"
    printf "Do you want to start the 'snet-salt-minion.service' [y/N]?" 
    read -r SERVICE
    if [ "$SERVICE" == "y" ]; then
        systemctl start snet-salt-minion.service
    fi
    
    return 0
}

MASTER=
MINION=$(hostname -f)
PREFIX=/opt/miniconda3
USAGE="
usage: $0 [options]

Installs Miniconda3 & Salt-Minion

-m          Set salt-master IP Address, -m [IP Address]
-i          Set salt-minion ID (default : hostname), -i [minion ID]"

while getopts "m:i:h" x; do
    case "$x" in
        h)
            printf "%s\\n" "$USAGE"
            exit 2
            ;;
        m)
            MASTER="$OPTARG"
            ;;
        i)
            MINION="$OPTARG"
            ;;
        ?)
            printf "ERROR: did not recognize option '%s', please try -h\\n" "$x"
            exit 1
            ;;
    esac
done

if [ "$MASTER" == "" ]; then
    printf "ERROR: Enter the Salt-Master IP, please try -h\\n" "$x"
    exit 1
fi

printf "Do you install Salt-Master?' [y/N]?" 
read -r MASTER_INSTALL
# if [ "$MASTER_INSTALL" == "y" ]; then
#     systemctl start snet-salt-minion.service
# fi

echo "
--------------------------------------------------
Salt-Master : $MASTER
Salt-Minion ID : $MINION
--------------------------------------------------"

printf "\\n"
printf "Miniconda3 will now be installed into this location:\\n"
printf "%s\\n" "$PREFIX"
printf "\\n"
printf "  - Press ENTER to confirm the location\\n"
printf "  - Press CTRL-C to abort the installation\\n"
printf "  - Or specify a different location below\\n"
printf "\\n"
printf "[%s] >>> " "$PREFIX"
read -r user_prefix
if [ "$user_prefix" != "" ]; then
    case "$user_prefix" in
        *\ * )
            printf "ERROR: Cannot install into directories with spaces\\n" >&2
            exit 1
            ;;
        *)
            eval PREFIX="$user_prefix"
            ;;
    esac
fi

case "$PREFIX" in
    *\ * )
        echo "case error"
        printf "ERROR: Cannot install into directories with spaces\\n" >&2
        exit 1
        ;;
esac

if [ "$FORCE" = "0" ] && [ -e "$PREFIX" ]; then
    printf "ERROR: File or directory already exists: '%s'\\n" "$PREFIX" >&2
    printf "If you want to update an existing installation, use the -u option.\\n" >&2
    exit 1
elif [ "$FORCE" = "1" ] && [ -e "$PREFIX" ]; then
    REINSTALL=1
fi

if ! mkdir -p "$PREFIX"; then
    printf "ERROR: Could not create directory: '%s'\\n" "$PREFIX" >&2
    exit 1
fi

PREFIX=$(cd "$PREFIX"; pwd)

conda_install