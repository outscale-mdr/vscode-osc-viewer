import * as vscode from 'vscode';
import * as path from 'path';
import { Profile } from '../flat/node';
import { CytoscapeNode } from './types';
import { getAllNetResources } from '../cloud/nets';
import { showResourceDetails } from '../extension';



// Main globals
let panel: vscode.WebviewPanel | undefined;
let extensionPath: string;
let resource: string | undefined;
let client: Profile | undefined;


export async function init(profile: Profile, resourceId: string, context: vscode.ExtensionContext) {
    resource = resourceId;
    client = profile;
    extensionPath = context.extensionPath;
    // Create the panel (held globally)
    panel = vscode.window.createWebviewPanel(
        `osc-viewer-network-view-${resourceId}`,
        `Network View of Net '${resourceId}'`,
        {
            preserveFocus: false,
            viewColumn: vscode.ViewColumn.Active
        },
        {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.file(path.join(extensionPath, 'assets'))],
            retainContextWhenHidden: true
        },
    );

    panel.webview.html = getWebviewContent();

    panel.webview.onDidReceiveMessage(
        message => {
            // Initial load of content, done at startup
            if (message.command === 'initialized') {
                sendData();
            }

            // Message from webview - user clicked 'Filters' button
            if (message.command === 'exportPNG') {
                savePNG(message.payload);
            }

            // Message from webview - user clicked 'Filters' button
            if (message.command === 'showDetails') {
                showResourceDetails(profile.name, message.payload.resourceType, message.payload.resourceId);
            }

        },
        undefined,
        context.subscriptions,
    );
}

async function retrieveData(): Promise<CytoscapeNode[] | string | undefined> {
    if (typeof resource === 'undefined') {
        return "The Net is not defined";
    }
    if (typeof client === 'undefined') {
        return "The client is not defined";
    }

    // Read The net
    const data: CytoscapeNode[] = [];
    // VPC
    data.push({
        data: {
            id: resource,
            label: resource,
            img: 'vpc.svg',
            type: 'vpc',
            resourceId: resource,
            showDetails: true
        },
        group: 'nodes'
    });

    // User
    data.push({
        data: {
            id: 'user',
            label: 'user',
            img: 'user.svg',
            showDetails: false
        },
        group: 'nodes'
    });

    const net = await getAllNetResources(client, resource);
    if (typeof net === 'string') {
        return net;
    }

    // AZ
    const azs = new Map<string, CytoscapeNode>();

    // Subnets
    net.subnets.forEach((subnet) => {
        if (typeof subnet.subnetId === 'undefined') {
            return undefined;
        }

        if (typeof subnet.subregionName === 'undefined') {
            return undefined;
        }

        if (!azs.has(subnet.subregionName)) {
            azs.set(subnet.subregionName, {
                data: {
                    id: subnet.subregionName,
                    label: subnet.subregionName,
                    parent: subnet.netId,
                    img: 'availability-zone.svg',
                    showDetails: false
                },
                group: 'nodes'
            });
        }
        data.push({
            data: {
                id: subnet.subnetId,
                label: subnet.subnetId,
                parent: subnet.subregionName,
                img: 'subnet.svg',
                showDetails: true,
                resourceId: subnet.subnetId,
                type: 'Subnet'

            },
            group: 'nodes'
        });
    });

    data.push(...azs.values());


    // VMs
    net.vms.forEach((vm) => {
        if (typeof vm.vmId === 'undefined') {
            return undefined;
        }
        data.push({
            data: {
                id: vm.vmId,
                label: vm.vmId,
                parent: vm.subnetId,
                img: 'vm.svg',
                showDetails: true,
                resourceId: vm.vmId,
                type: 'vms'
            },
            group: 'nodes'
        });

        if (typeof vm.publicIp !== 'undefined') {
            data.push({
                data: {
                    id: vm.publicIp,
                    label: vm.publicIp,
                    parent: vm.vmId,
                    img: 'publicIp.svg',
                    showDetails: true,
                    resourceId: vm.publicIp, // todo
                    type: 'eips'
                },
                group: 'nodes'
            });

            data.push({
                data: {
                    id: vm.publicIp + 'user',
                    label: '',
                    source: 'user',
                    target: vm.publicIp
                },
                group: 'edges'
            });
        }
    });

    // Route Tables
    net.routeTables.forEach((rt) => {
        if (typeof rt.routeTableId === 'undefined') {
            return undefined;
        }

        const rtEl: string[] = [];
        if (typeof rt.linkRouteTables === 'undefined') {
            rtEl.push(rt.routeTableId);
            data.push({
                data: {
                    id: rt.routeTableId,
                    label: rt.routeTableId,
                    parent: rt.netId,
                    img: 'route-table.svg',
                    showDetails: true,
                    resourceId: rt.routeTableId,
                    type: 'routetables'
                },
                group: 'nodes'
            });
        } else {
            let count = 0;
            for (const link of rt.linkRouteTables) {
                rtEl.push(rt.routeTableId + count);
                data.push({
                    data: {
                        id: rt.routeTableId + count,
                        label: rt.routeTableId,
                        parent: typeof link.subnetId === 'undefined' ? rt.netId : link.subnetId,
                        img: 'route-table.svg',
                        showDetails: true,
                        resourceId: rt.routeTableId,
                        type: 'routetables'
                    },
                    group: 'nodes'
                });
                count += 1;
            }

        }

        if (typeof rt.routes !== 'undefined') {
            rt.routes.forEach((route) => {
                // Looking for IS
                if (typeof route.gatewayId !== 'undefined') {
                    const gatewayId = route.gatewayId;
                    rtEl.forEach((rtId) => {
                        data.push({
                            data: {
                                id: 'routes' + rtId + route.gatewayId,
                                source: rtId,
                                target: gatewayId,
                                label: '' + route.destinationIpRange
                            },
                            group: 'edges'
                        });
                    });
                }

                // Looking for Nat
                if (typeof route.natServiceId !== 'undefined') {
                    const natServiceId = route.natServiceId;
                    rtEl.forEach((rtId) => {
                        data.push({
                            data: {
                                id: 'routes' + rtId + route.natServiceId,
                                source: rtId,
                                target: natServiceId,
                                label: '' + route.destinationIpRange
                            },
                            group: 'edges'
                        });
                    });
                }
            });
        }


    });

    // NAT Services
    net.nats.forEach((nat) => {
        if (typeof nat.natServiceId === 'undefined') {
            return undefined;
        }

        data.push({
            data: {
                id: nat.natServiceId,
                label: nat.natServiceId,
                parent: nat.subnetId,
                img: 'vpc-nat-gateway.svg',
                showDetails: true,
                resourceId: nat.natServiceId,
                type: 'NatService'
            },
            group: 'nodes'
        });
    });

    // LBUs
    net.loadbalancers.forEach((lbu) => {
        if (typeof lbu.loadBalancerName === 'undefined') {
            return undefined;
        }
        data.push({
            data: {
                id: lbu.loadBalancerName,
                label: lbu.loadBalancerName,
                parent: typeof lbu.subnets === 'undefined' ? lbu.netId : lbu.subnets[0],
                img: 'classic-load-balancer.svg',
                showDetails: true,
                resourceId: lbu.loadBalancerName,
                type: 'loadbalancers'
            },
            group: 'nodes'
        });

        if (typeof lbu.backendVmIds !== 'undefined') {
            for (const backend of lbu.backendVmIds) {
                data.push({
                    data: {
                        id: lbu.loadBalancerName + backend,
                        source: lbu.loadBalancerName,
                        target: backend,
                        label: '',
                    },
                    group: 'edges',
                });
            }
        }

        if (typeof lbu.loadBalancerType !== 'undefined') {
            if (lbu.loadBalancerType === 'internet-facing') {
                data.push({
                    data: {
                        id: lbu.loadBalancerName + 'user',
                        source: 'user',
                        target: lbu.loadBalancerName,
                        label: ''
                    },
                    group: 'edges'
                });
            }
        }
    });

    // Internet Services
    net.internetServices.forEach((is) => {
        if (typeof is.internetServiceId === 'undefined') {
            return undefined;
        }

        data.push({
            data: {
                id: is.internetServiceId,
                label: is.internetServiceId,
                parent: is.netId,
                img: 'internet-gateway.svg',
                showDetails: true,
                resourceId: is.internetServiceId,
                type: 'InternetService'
            },
            group: 'nodes'
        });
    });

    // Net access point
    net.netAccessPoints.forEach((nap) => {
        if (typeof nap.netAccessPointId === 'undefined') {
            return undefined;
        }

        data.push({
            data: {
                id: nap.netAccessPointId,
                label: nap.netAccessPointId,
                parent: nap.netId,
                img: 'vpc-endpoints.svg',
                showDetails: true,
                resourceId: nap.netAccessPointId,
                type: 'NetAccessPoint'
            },
            group: 'nodes'
        });
    });

    //  Security Groups
    net.securityGroups.forEach((sg) => {
        if (typeof sg.securityGroupId === 'undefined' || typeof sg.securityGroupName === 'undefined') {
            return undefined;
        }

        data.push({
            data: {
                id: sg.securityGroupId,
                label: sg.securityGroupName,
                parent: sg.netId,
                img: 'sg.svg',
                showDetails: true,
                resourceId: sg.securityGroupId,
                type: 'securitygroups'
            },
            group: 'nodes'
        });
    });

    return data;

}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function savePNG(data: any) {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const saveAs = await vscode.window.showSaveDialog({ saveLabel: 'Save PNG', filters: { Images: ['png'] } });
    if (saveAs) {
        const buf = Buffer.from(data, 'base64');
        vscode.workspace.fs.writeFile(saveAs, buf);
    }
}

async function sendData() {
    const data = await retrieveData();

    if (typeof panel === 'undefined') {
        return;
    }
    panel.webview.postMessage({ command: 'newData', payload: data });
}


function getWebviewContent(): string {
    // Just in case, shouldn't happen
    if (!panel) {
        return '';
    }

    const assetsPath = panel.webview.asWebviewUri(vscode.Uri.file(path.join(extensionPath, 'assets')));
    const iconThemeBase = panel.webview.asWebviewUri(
        vscode.Uri.file(path.join(extensionPath, 'assets', 'img')),
    ).toString();

    return `
    <!DOCTYPE html>
    <html lang="en">
    
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
      <script src="${assetsPath}/js/vendor/jquery-3.4.1.slim.min.js"></script>
      <script src="${assetsPath}/js/vendor/cytoscape.min.js"></script>
      <script src="${assetsPath}/js/vendor/cytoscape-snap-to-grid.js"></script>
      <script src="${assetsPath}/js/vendor/layout-base.js"></script>
      <script src="${assetsPath}/js/vendor/cose-base.js"></script>
      <script src="${assetsPath}/js/vendor/cytoscape-cose-bilkent.js"></script>
    
      <script src="${assetsPath}/js/main.js"></script>
      <link href="${assetsPath}/css/main.css" rel="stylesheet" type="text/css">
    
      <title>Osc Viewer</title>
    </head>
    
    <body>
      <div id="buttons">
        <button onclick="resize()" title="Zoom to fit"><img src="${assetsPath}/img/toolbar/fit.svg"><span class="lab">&nbsp;
            Zoom to fit</span></button>
        <button onclick="reLayout()" title="Relayout"><img src="${assetsPath}/img/toolbar/fit.svg"><span class="lab">&nbsp;
            Relayout</span></button>
        <button onclick="exportPNG()" title="Export view as PNG"><img src="${assetsPath}/img/toolbar/export.svg"><span
            class="lab">&nbsp; Export</span></button>
        <button onclick="showDetails()" title="Export view as PNG" id="details" disabled="true"><img src="${assetsPath}/img/toolbar/export.svg"><span
            class="lab">&nbsp; Show</span></button>
      </div>
    
      <div class="loader"></div>
      <div id="mainview"></div>
    
      <script>
        init("${iconThemeBase}");
      </script>
    
    </body>
    
    </html>`;
}
