export const API_PREFIX='/api/v1' as const;
export interface ApiSuccess<T>{success:true;data:T;requestId:string}
export interface ApiFailure{success:false;error:{code:string;message:string;details?:unknown};requestId:string}
