export type ProviderCapability='listFolders'|'listMessages'|'readMessage'|'sendMessage'|'searchMessages'|'mutateFlags'|'manageFolders';
export interface ProviderHealth{imap:'available'|'unavailable'|'not-configured';smtp:'available'|'unavailable'|'not-configured';checkedAt:Date}
export interface ProviderMessageSummary{id:string;folderId:string;subject:string;from:string;receivedAt:Date;unread:boolean}
export interface MailProvider{readonly providerId:string;capabilities():ReadonlySet<ProviderCapability>;checkHealth():Promise<ProviderHealth>;listMessages(folderId:string,limit:number):Promise<ProviderMessageSummary[]>}
export class ProviderCapabilityError extends Error{constructor(capability:ProviderCapability){super('Provider does not support capability: '+capability);this.name='ProviderCapabilityError'}}
