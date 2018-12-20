declare module "json-cycle" {
    interface JsonCycle {
        decycle(object: object): object;
        retrocycle(object: object): object;
        stringify(object: object): string;
        parse(json: string): object;
    }

    const JsonCycleExport: JsonCycle;

    export = JsonCycleExport;
}