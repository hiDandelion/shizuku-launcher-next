var AWS = require('aws-sdk');
var proxyAgent = require('proxy-agent');

export default function handler(req, res) {
    const systemImageNameMap = new Map([["debian-10", "debian-10-amd64-2022*"], ["debian-11", "debian-11-amd64-2022*"], ["ubuntu-20.04", "ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-2022*"], ["ubuntu-22.04", "ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-2022*"], ["Arch Linux", "*"], ["windows-server-2022-sc", "Windows_Server-2022-Chinese_Simplified-Full-Base-*"], ["windows-server-2022-en", "Windows_Server-2022-English-Full-Base-*"]]);
    const systemImageOwnerMap = new Map([["debian-10", "136693071363"], ["debian-11", "136693071363"], ["ubuntu-20.04", "099720109477"], ["ubuntu-22.04", "099720109477"], ["Arch Linux", "647457786197"], ["windows-server-2022-sc", "801119661308"], ["windows-server-2022-en", "801119661308"]]);
    AWS.config = new AWS.Config();
    AWS.config.update(
        {
            accessKeyId: req.body.aki,
            secretAccessKey: req.body.saki,
            region: req.body.region
        }
    );
    if (req.body.useProxy) {
        AWS.config.update({
            httpOptions: { agent: proxyAgent(req.body.proxy) }
        });
    }
    var ec2 = new AWS.EC2();
    var imageName = systemImageNameMap.get(req.body.system);
    var imageOwner = systemImageOwnerMap.get(req.body.system);
    var imageParams = {
        Filters: [
            {
                Name: 'name',
                Values: [
                    imageName
                ]
            },
            {
                Name: 'architecture',
                Values: [
                    'x86_64'
                ]
            }
        ],
        Owners: [
            imageOwner
        ]
    }
    ec2.describeImages(imageParams, function (err, data) {
        if (err) {
            res.status(500).send({
                error: err
            });
        }
        else {
            var imageId = data.Images[0].ImageId
            var keyName = String(Date.now())
            var keyParams = {
                KeyName: keyName
            };
            ec2.createKeyPair(keyParams, function (err, data) {
                if (err) {
                    res.status(500).send({
                        error: err
                    });
                } else {
                    var keyMaterial = data.KeyMaterial;
                    var sgParams = {
                        Description: keyName,
                        GroupName: keyName
                    }
                    ec2.createSecurityGroup(sgParams, function (err, data) {
                        if (err) {
                            res.status(500).send({
                                error: err
                            });
                        } else {
                            var groupId = data.GroupId
                            var asgParams = {
                                GroupId: groupId,
                                IpPermissions: [
                                    {
                                        FromPort: 0,
                                        IpProtocol: "tcp",
                                        IpRanges: [
                                            {
                                                CidrIp: "0.0.0.0/0",
                                                Description: "All TCP"
                                            }
                                        ],
                                        ToPort: 65535
                                    },
                                    {
                                        FromPort: 0,
                                        IpProtocol: "udp",
                                        IpRanges: [
                                            {
                                                CidrIp: "0.0.0.0/0",
                                                Description: "All UDP"
                                            }
                                        ],
                                        ToPort: 65535
                                    },
                                    {
                                        FromPort: -1,
                                        IpProtocol: "icmp",
                                        IpRanges: [
                                            {
                                                CidrIp: "0.0.0.0/0",
                                                Description: "All ICMP"
                                            }
                                        ],
                                        ToPort: -1
                                    },
                                    {
                                        FromPort: -1,
                                        IpProtocol: "icmpv6",
                                        IpRanges: [
                                            {
                                                CidrIp: "0.0.0.0/0",
                                                Description: "All ICMPV6"
                                            }
                                        ],
                                        ToPort: -1
                                    }
                                ]
                            };
                            ec2.authorizeSecurityGroupIngress(asgParams, function (err, data) {
                                if (err) {
                                    res.status(500).send({
                                        error: err
                                    });
                                } else {
                                    var userData = "";
                                    if (req.body.systemType == "Linux") {
                                        var userDataRaw = "#!/bin/bash\necho root:" + req.body.password + "|sudo chpasswd root\nsudo rm -rf /etc/ssh/sshd_config\nsudo tee /etc/ssh/sshd_config <<EOF\nClientAliveInterval 120\nSubsystem       sftp    /usr/lib/openssh/sftp-server\nX11Forwarding yes\nPrintMotd no\nChallengeResponseAuthentication no\nPasswordAuthentication yes\nPermitRootLogin yes\nUsePAM yes\nAcceptEnv LANG LC_*\nEOF\nsudo systemctl restart sshd\n"
                                        userData = btoa(userDataRaw)
                                    }
                                    var instanceParams = {
                                        BlockDeviceMappings: [
                                            {
                                                DeviceName: "/dev/xvda",
                                                Ebs: {
                                                    VolumeSize: parseInt(req.body.disk)
                                                }
                                            }
                                        ],
                                        ImageId: imageId,
                                        InstanceType: req.body.type,
                                        KeyName: keyName,
                                        MinCount: 1,
                                        MaxCount: 1,
                                        SecurityGroupIds: [
                                            groupId
                                        ],
                                        UserData: userData
                                    };
                                    ec2.runInstances(instanceParams, function (err, data) {
                                        if (err) {
                                            res.status(500).send({
                                                error: err
                                            });
                                        } else {
                                            res.status(200).send({
                                                instanceId: data.Instances[0].InstanceId,
                                                KeyMaterial: keyMaterial
                                            });
                                        }
                                    });
                                }
                            });
                        }
                    });
                }
            });
        }
    });
}