import { ThemeIcon } from 'vscode';
import { deleteVm, startVm, stopVm } from '../cloud/vm';
import { Profile } from './node';
import { ResourceNode } from './node.resources';


export class VmResourceNode extends ResourceNode {

    constructor(readonly profile: Profile, readonly resourceName: string, readonly resourceId: string, readonly resourceState:string) {
		super(profile, resourceName, resourceId, "vms", deleteVm);
    }

	startResource(): Promise<string | undefined> {
		return startVm(this.profile, this.resourceId);
	}

	stopResource(): Promise<string | undefined> {
		return stopVm(this.profile, this.resourceId);
	}

	getContextValue(): string {
		return "vmresourcenode";
	}

	getIconPath(): ThemeIcon {
		switch (this.resourceState) {
			case "running":
				return new ThemeIcon("debug-start");
			case "stopping":
			case "stopped":
				return new ThemeIcon("debug-pause");
			case "shutting-down":
				return new ThemeIcon("debug-disconnect");
			case "pending":
				return new ThemeIcon("repo-create");
			default:
				return new ThemeIcon("dash");
		}
		
	}

}