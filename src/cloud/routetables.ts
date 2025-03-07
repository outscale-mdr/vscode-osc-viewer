
import * as osc from "outscale-api";
import { getConfig } from './cloud';
import { Profile } from "../flat/node";


export function getRouteTables(profile: Profile): Promise<Array<osc.RouteTable> | string> {
    const config = getConfig(profile);
    const readParameters : osc.ReadRouteTablesOperationRequest = {
        readRouteTablesRequest: {}
    };

    const api = new osc.RouteTableApi(config);
    return api.readRouteTables(readParameters)
    .then((res: osc.ReadRouteTablesResponse | string) => {
        if (typeof res === "string") {
            return res;
        }
        if (res.routeTables === undefined || res.routeTables.length === 0) {
            return "Listing suceeded but it seems you have no RouteTables";
        }
        return res.routeTables;
    }, (err_: any) => {
        return "Error, bad credential or region?" + err_;
    });
}

export function getRouteTable(profile: Profile, routeTableId: string): Promise<osc.RouteTable | string> {
    const config = getConfig(profile);
    const readParameters : osc.ReadRouteTablesOperationRequest = {
        readRouteTablesRequest: {
            filters: {
                routeTableIds: [routeTableId]
            }
        }
    };

    const api = new osc.RouteTableApi(config);
    return api.readRouteTables(readParameters)
    .then((res: osc.ReadRouteTablesResponse | string) => {
        if (typeof res === "string") {
            return res;
        }
        if (res.routeTables === undefined || res.routeTables.length === 0) {
            return "Listing suceeded but it seems you have no Routetables";
        }
        return res.routeTables[0];
    }, (err_: any) => {
        return "Error, bad credential or region?" + err_;
    });
}

export function deleteRouteTable(profile: Profile, resourceId: string): Promise<string | undefined> {
    const config = getConfig(profile);
    const deleteParameters : osc.DeleteRouteTableOperationRequest = {
        deleteRouteTableRequest: {
            routeTableId: resourceId
        }
    };

    const api = new osc.RouteTableApi(config);
    return api.deleteRouteTable(deleteParameters)
    .then((res: osc.DeleteRouteTableResponse | string) => {
        if (typeof res === "string") {
            return res;
        }
        return undefined;
    }, (err_: any) => {
        return "Error, bad credential or region?" + err_;
    });
}