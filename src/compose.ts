import Functions from 'firebase-functions';

export interface RequestContext extends Functions.https.CallableContext {
    functionName: string;
    responseBody: any;
}

export const HttpsError = Functions.https.HttpsError;
export type OnCallFunction = (data: any, context: Functions.https.CallableContext) => any | Promise<any>;
export type FinalFunction = (data: any, ctx: RequestContext) => Promise<void>;
export type RouteFunctions = {[key: string]: FinalFunction};
export type MiddlewareFunction = (data: any, ctx: RequestContext, next?: () => Promise<void>) => void | Promise<void>;

export function doExport(exportsObject: any, routeFunctionsArray: Array<RouteFunctions>, middlewares: Array<MiddlewareFunction>) {
    for (const routeFunctions of routeFunctionsArray) {
        for (const key of Object.keys(routeFunctions)) {
            const functionName = key;
            const functionBody = routeFunctions[key];

            const handler: OnCallFunction = async (data, ctx) => {
                const context = ctx as RequestContext;
                context.functionName = functionName;
                context.responseBody = null;

                await compose(middlewares.concat([functionBody]))(data, context);

                return context.responseBody;
            };

            exportsObject[key] = Functions.https.onCall(handler);
        }
    }
}

function compose(middlewares: MiddlewareFunction[]) {
    return (data: any, ctx: RequestContext, next?: () => void) => {
        let index = -1;
        function dispatch(i: number): Promise<void> {
            if (i < index) {
                return Promise.reject(new Error('next() called multiple times'));
            }
            index = i;
            let fn: MiddlewareFunction | undefined = middlewares[i];
            if (i === middlewares.length) {
                fn = next;
            }
            if (!fn) {
                return Promise.resolve();
            }
            try {
                return Promise.resolve(fn(data, ctx, dispatch.bind(null, i + 1)));
            } catch (e) {
                return Promise.reject(e);
            }
        }
        return dispatch(0);
    }
}
