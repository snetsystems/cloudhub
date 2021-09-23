export const saltDetailsDummy = `
local:
  - AmiLaunchIndex: 0
    Architecture: x86_64
    BlockDeviceMappings:
      - DeviceName: /dev/xvda
        Ebs:
          AttachTime: 2020-06-11 01:07:25+00:00
          DeleteOnTermination: true
          Status: attached
          VolumeId: vol-059a298c504c31166
    CapacityReservationSpecification:
      CapacityReservationPreference: open
    ClientToken: ''
    CpuOptions:
      CoreCount: 1
      ThreadsPerCore: 1
    EbsOptimized: false
    EnaSupport: true
    HibernationOptions:
      Configured: false
    Hypervisor: xen
    ImageId: ami-0185fd13b4270de70
    InstanceId: i-04575c09b9272e51c
    InstanceType: t2.micro
    KeyName: snet-keypair
    LaunchTime: 2020-06-11 01:07:24+00:00
    MetadataOptions:
      HttpEndpoint: enabled
      HttpPutResponseHopLimit: 1
      HttpTokens: optional
      State: applied
    Monitoring:
      State: disabled
    NetworkInterfaces:
      - Association:
          IpOwnerId: 055008654303
          PublicDnsName: ''
          PublicIp: 15.164.136.185
        Attachment:
          AttachTime: 2020-06-11 01:07:24+00:00
          AttachmentId: eni-attach-0fcea24df24a45182
          DeleteOnTermination: true
          DeviceIndex: 0
          Status: attached
        Description: Primary network interface
        Groups:
          - GroupId: sg-08d34bb2fa835f3dd
            GroupName: snet-bastion-sg
        InterfaceType: interface
        Ipv6Addresses: []
        MacAddress: 02:fd:05:fd:95:76
        NetworkInterfaceId: eni-031e485fe3e018deb
        OwnerId: 055008654303
        PrivateIpAddress: 172.16.0.11
        PrivateIpAddresses:
          - Association:
              IpOwnerId: 055008654303
              PublicDnsName: ''
              PublicIp: 15.164.136.185
            Primary: true
            PrivateIpAddress: 172.16.0.11
        SourceDestCheck: false
        Status: in-use
        SubnetId: subnet-01a6e940f6369127a
        VpcId: vpc-0232fadb6889f4049
    Placement:
      AvailabilityZone: ap-northeast-2a
      GroupName: ''
      Tenancy: default
    PrivateDnsName: ip-172-16-0-11.ap-northeast-2.compute.internal
    PrivateIpAddress: 172.16.0.11
    ProductCodes: []
    PublicDnsName: ''
    PublicIpAddress: 15.164.136.185
    RootDeviceName: /dev/xvda
    RootDeviceType: ebs
    SecurityGroups:
      - GroupId: sg-08d34bb2fa835f3dd
        GroupName: snet-bastion-sg
    SourceDestCheck: false
    State:
      Code: 16
      Name: running
    StateTransitionReason: ''
    SubnetId: subnet-01a6e940f6369127a
    Tags:
      - Key: Name
        Value: snet-NCU_Web_Server
    VirtualizationType: hvm
    VpcId: vpc-0232fadb6889f4049
  - AmiLaunchIndex: 0
    Architecture: x86_64
    BlockDeviceMappings:
      - DeviceName: /dev/xvda
        Ebs:
          AttachTime: 2020-06-11 01:07:25+00:00
          DeleteOnTermination: true
          Status: attached
          VolumeId: vol-059a298c504c31166
    CapacityReservationSpecification:
      CapacityReservationPreference: open
    ClientToken: ''
    CpuOptions:
      CoreCount: 1
      ThreadsPerCore: 1
    EbsOptimized: false
    EnaSupport: true
    HibernationOptions:
      Configured: false
    Hypervisor: xen
    ImageId: ami-0185fd13b4270de70
    InstanceId: i-06b26a0c3fa37533a
    InstanceType: t2.micro
    KeyName: snet-keypair
    LaunchTime: 2020-06-11 01:07:24+00:00
    MetadataOptions:
      HttpEndpoint: enabled
      HttpPutResponseHopLimit: 1
      HttpTokens: optional
      State: applied
    Monitoring:
      State: disabled
    NetworkInterfaces:
      - Association:
          IpOwnerId: 055008654303
          PublicDnsName: ''
          PublicIp: 15.164.136.185
        Attachment:
          AttachTime: 2020-06-11 01:07:24+00:00
          AttachmentId: eni-attach-0fcea24df24a45182
          DeleteOnTermination: true
          DeviceIndex: 0
          Status: attached
        Description: Primary network interface
        Groups:
          - GroupId: sg-08d34bb2fa835f3dd
            GroupName: snet-bastion-sg
        InterfaceType: interface
        Ipv6Addresses: []
        MacAddress: 02:fd:05:fd:95:76
        NetworkInterfaceId: eni-031e485fe3e018deb
        OwnerId: 055008654303
        PrivateIpAddress: 172.16.0.11
        PrivateIpAddresses:
          - Association:
              IpOwnerId: 055008654303
              PublicDnsName: ''
              PublicIp: 15.164.136.185
            Primary: true
            PrivateIpAddress: 172.16.0.11
        SourceDestCheck: false
        Status: in-use
        SubnetId: subnet-01a6e940f6369127a
        VpcId: vpc-0232fadb6889f4049
    Placement:
      AvailabilityZone: ap-northeast-2a
      GroupName: ''
      Tenancy: default
    PrivateDnsName: ip-172-16-0-11.ap-northeast-2.compute.internal
    PrivateIpAddress: 172.16.0.11
    ProductCodes: []
    PublicDnsName: ''
    PublicIpAddress: 15.164.136.185
    RootDeviceName: /dev/xvda
    RootDeviceType: ebs
    SecurityGroups:
      - GroupId: sg-08d34bb2fa835f3dd
        GroupName: snet-bastion-sg
    SourceDestCheck: false
    State:
      Code: 16
      Name: running
    StateTransitionReason: ''
    SubnetId: subnet-01a6e940f6369127a
    Tags:
      - Key: Name
        Value: snet-bastion
    VirtualizationType: hvm
    VpcId: vpc-0232fadb6889f4049
  - AmiLaunchIndex: 0
    Architecture: x86_64
    BlockDeviceMappings:
      - DeviceName: /dev/sda1
        Ebs:
          AttachTime: 2020-06-11 03:08:08+00:00
          DeleteOnTermination: false
          Status: attached
          VolumeId: vol-062f6cb6c6ebaa2d3
      - DeviceName: xvdb
        Ebs:
          AttachTime: 2020-06-11 03:08:08+00:00
          DeleteOnTermination: false
          Status: attached
          VolumeId: vol-0954e00fea4eabc06
    CapacityReservationSpecification:
      CapacityReservationPreference: open
    ClientToken: ''
    CpuOptions:
      CoreCount: 2
      ThreadsPerCore: 2
    EbsOptimized: true
    EnaSupport: true
    HibernationOptions:
      Configured: false
    Hypervisor: xen
    ImageId: ami-045026cf9173c6dcb
    InstanceId: i-01c872eb8ded1a221
    InstanceType: c5.xlarge
    KeyName: snet-keypair
    LaunchTime: 2020-06-11 03:08:07+00:00
    MetadataOptions:
      HttpEndpoint: enabled
      HttpPutResponseHopLimit: 1
      HttpTokens: optional
      State: applied
    Monitoring:
      State: disabled
    NetworkInterfaces:
      - Attachment:
          AttachTime: 2020-06-11 03:08:07+00:00
          AttachmentId: eni-attach-089990a0a05551b54
          DeleteOnTermination: true
          DeviceIndex: 0
          Status: attached
        Description: Primary network interface
        Groups:
          - GroupId: sg-0c043bc9543543e50
            GroupName: snet-NCU_Analysis_Server-sg
        InterfaceType: interface
        Ipv6Addresses: []
        MacAddress: 02:a9:90:0f:b1:be
        NetworkInterfaceId: eni-0a084a0a0db8e7f50
        OwnerId: 055008654303
        PrivateIpAddress: 172.16.0.90
        PrivateIpAddresses:
          - Primary: true
            PrivateIpAddress: 172.16.0.90
        SourceDestCheck: true
        Status: in-use
        SubnetId: subnet-021b6a7105cbb5eb4
        VpcId: vpc-0232fadb6889f4049
    Placement:
      AvailabilityZone: ap-northeast-2a
      GroupName: ''
      Tenancy: default
    Platform: windows
    PrivateDnsName: ip-172-16-0-90.ap-northeast-2.compute.internal
    PrivateIpAddress: 172.16.0.90
    ProductCodes: []
    PublicDnsName: ''
    RootDeviceName: /dev/sda1
    RootDeviceType: ebs
    SecurityGroups:
      - GroupId: sg-0c043bc9543543e50
        GroupName: snet-NCU_Analysis_Server-sg
    SourceDestCheck: true
    State:
      Code: 16
      Name: running
    StateTransitionReason: ''
    SubnetId: subnet-021b6a7105cbb5eb4
    Tags:
      - Key: Name
        Value: snet-NCU_Analysis_Server
    VirtualizationType: hvm
    VpcId: vpc-0232fadb6889f4049
  - AmiLaunchIndex: 0
    Architecture: x86_64
    BlockDeviceMappings:
      - DeviceName: /dev/sda1
        Ebs:
          AttachTime: 2020-06-11 02:55:53+00:00
          DeleteOnTermination: false
          Status: attached
          VolumeId: vol-004376ce04e6ee217
      - DeviceName: /dev/sdb
        Ebs:
          AttachTime: 2020-06-11 02:55:53+00:00
          DeleteOnTermination: false
          Status: attached
          VolumeId: vol-0524ef325cb86e732
    CapacityReservationSpecification:
      CapacityReservationPreference: open
    ClientToken: ''
    CpuOptions:
      CoreCount: 2
      ThreadsPerCore: 2
    EbsOptimized: true
    EnaSupport: true
    HibernationOptions:
      Configured: false
    Hypervisor: xen
    ImageId: ami-00edfb46b107f643c
    InstanceId: i-00e6871ee586c496d
    InstanceType: c5.xlarge
    KeyName: snet-keypair
    LaunchTime: 2020-06-11 02:55:52+00:00
    MetadataOptions:
      HttpEndpoint: enabled
      HttpPutResponseHopLimit: 1
      HttpTokens: optional
      State: applied
    Monitoring:
      State: disabled
    NetworkInterfaces:
      - Attachment:
          AttachTime: 2020-06-11 02:55:52+00:00
          AttachmentId: eni-attach-04c866f1997e098d3
          DeleteOnTermination: true
          DeviceIndex: 0
          Status: attached
        Description: Primary network interface
        Groups:
          - GroupId: sg-0642d0504bde678dc
            GroupName: snet-SaaS_Portal_WebServer-sg
        InterfaceType: interface
        Ipv6Addresses: []
        MacAddress: 02:5b:59:3d:f4:f6
        NetworkInterfaceId: eni-0541c7abb3261dc4d
        OwnerId: 055008654303
        PrivateIpAddress: 172.16.0.69
        PrivateIpAddresses:
          - Primary: true
            PrivateIpAddress: 172.16.0.69
        SourceDestCheck: true
        Status: in-use
        SubnetId: subnet-021b6a7105cbb5eb4
        VpcId: vpc-0232fadb6889f4049
    Placement:
      AvailabilityZone: ap-northeast-2a
      GroupName: ''
      Tenancy: default
    PrivateDnsName: ip-172-16-0-69.ap-northeast-2.compute.internal
    PrivateIpAddress: 172.16.0.69
    ProductCodes: []
    PublicDnsName: ''
    RootDeviceName: /dev/sda1
    RootDeviceType: ebs
    SecurityGroups:
      - GroupId: sg-0642d0504bde678dc
        GroupName: snet-SaaS_Portal_WebServer-sg
    SourceDestCheck: true
    State:
      Code: 16
      Name: running
    StateTransitionReason: ''
    SubnetId: subnet-021b6a7105cbb5eb4
    Tags:
      - Key: Name
        Value: snet-SaaS_Portal_WebServer
    VirtualizationType: hvm
    VpcId: vpc-0232fadb6889f4049
  - AmiLaunchIndex: 0
    Architecture: x86_64
    BlockDeviceMappings:
      - DeviceName: /dev/sda1
        Ebs:
          AttachTime: 2020-06-11 03:10:42+00:00
          DeleteOnTermination: false
          Status: attached
          VolumeId: vol-0b07d8c29f554e040
      - DeviceName: /dev/sdb
        Ebs:
          AttachTime: 2020-06-11 03:10:42+00:00
          DeleteOnTermination: false
          Status: attached
          VolumeId: vol-03ad368039a22c1f3
    CapacityReservationSpecification:
      CapacityReservationPreference: open
    ClientToken: ''
    CpuOptions:
      CoreCount: 2
      ThreadsPerCore: 2
    EbsOptimized: true
    EnaSupport: true
    HibernationOptions:
      Configured: false
    Hypervisor: xen
    ImageId: ami-00edfb46b107f643c
    InstanceId: i-0002a75dce49b38dc
    InstanceType: c5.xlarge
    KeyName: snet-keypair
    LaunchTime: 2020-06-11 03:10:41+00:00
    MetadataOptions:
      HttpEndpoint: enabled
      HttpPutResponseHopLimit: 1
      HttpTokens: optional
      State: applied
    Monitoring:
      State: disabled
    NetworkInterfaces:
      - Attachment:
          AttachTime: 2020-06-11 03:10:41+00:00
          AttachmentId: eni-attach-0fbb330051083802f
          DeleteOnTermination: true
          DeviceIndex: 0
          Status: attached
        Description: Primary network interface
        Groups:
          - GroupId: sg-0b7cbbeb155c5b8b9
            GroupName: snet-DB_Server-sg
        InterfaceType: interface
        Ipv6Addresses: []
        MacAddress: 02:37:43:a2:ec:46
        NetworkInterfaceId: eni-0239b72c78d157a8f
        OwnerId: 055008654303
        PrivateIpAddress: 172.16.0.158
        PrivateIpAddresses:
          - Primary: true
            PrivateIpAddress: 172.16.0.158
        SourceDestCheck: true
        Status: in-use
        SubnetId: subnet-087fd89c01b0ec538
        VpcId: vpc-0232fadb6889f4049
    Placement:
      AvailabilityZone: ap-northeast-2a
      GroupName: ''
      Tenancy: default
    PrivateDnsName: ip-172-16-0-158.ap-northeast-2.compute.internal
    PrivateIpAddress: 172.16.0.158
    ProductCodes: []
    PublicDnsName: ''
    RootDeviceName: /dev/sda1
    RootDeviceType: ebs
    SecurityGroups:
      - GroupId: sg-0b7cbbeb155c5b8b9
        GroupName: snet-DB_Server-sg
    SourceDestCheck: true
    State:
      Code: 16
      Name: running
    StateTransitionReason: ''
    SubnetId: subnet-087fd89c01b0ec538
    Tags:
      - Key: Name
        Value: snet-DB_Server
    VirtualizationType: hvm
    VpcId: vpc-0232fadb6889f4049
`
