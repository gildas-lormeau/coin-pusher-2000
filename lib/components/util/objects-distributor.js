import { Vector3 } from "three";

export default class {
    #objectTypesOrder;

    constructor({ Coins, Tokens, Cards, Ingots }) {
        this.#objectTypesOrder = [
            { Type: Cards, size: Cards.getSize() },
            { Type: Ingots, size: Ingots.getSize() },
            { Type: Tokens, size: Tokens.getSize() },
            { Type: Coins, size: Coins.getSize() }
        ];
    }

    deposit(position, region, objectsData, options = {}) {
        const { x, y, z } = position;
        const [width, height] = region;
        let currentY = y;
        const objects = [];
        for (let indexType = 0; indexType < this.#objectTypesOrder.length; indexType++) {
            const { Type, size } = this.#objectTypesOrder[indexType];
            const objectsType = objectsData.get(Type);
            if (objectsType && objectsType.length) {
                const objectsPerRowX = Math.floor(width / size.width);
                const objectsPerRowZ = Math.floor(height / size.height);
                const actualRowsX = Math.min(objectsPerRowX, objectsType.length);
                const actualRowsZ = Math.min(objectsPerRowZ, Math.ceil(objectsType.length / objectsPerRowX));
                const usedWidth = Math.max(actualRowsX * size.width, size.width);
                const usedHeight = Math.max(actualRowsZ * size.height, size.height);
                const startX = x - usedWidth / 2 + size.width / 2;
                const startZ = z - usedHeight / 2 + size.height / 2;
                let currentX = startX;
                let currentZ = startZ;
                let objectsInCurrentRowX = 0;
                let objectsInCurrentRowZ = 0;
                for (let indexObject = 0; indexObject < objectsType.length; indexObject++) {
                    const type = (objectsType[indexObject] && objectsType[indexObject].type) || 0;
                    const rotation = options.randomRotation ? new Vector3(
                        (Math.random() - 0.5) * Math.PI / 2 + (Math.random() < 0.5 ? Math.PI : 0),
                        (Math.random() - 0.5) * Math.PI / 2,
                        (Math.random() - 0.5) * Math.PI / 2
                    ) : new Vector3(0, 0, 0);
                    const position = options.randomPosition ? new Vector3(
                        currentX + (Math.random() / 100 - 0.005),
                        currentY,
                        currentZ + (Math.random() / 100 - 0.005)
                    ) : new Vector3(currentX, currentY, currentZ);
                    objects.push(Type.deposit({ position, type, rotation }));
                    objectsInCurrentRowX++;
                    currentX += size.width;
                    if (objectsInCurrentRowX >= objectsPerRowX) {
                        objectsInCurrentRowX = 0;
                        objectsInCurrentRowZ++;
                        currentX = startX;
                        currentZ += size.height;
                        if (objectsInCurrentRowZ >= objectsPerRowZ) {
                            objectsInCurrentRowZ = 0;
                            currentZ = startZ;
                            if (!options.compacted) {
                                currentY += size.depth;
                            }
                        }
                    }
                }
                currentY += size.depth;
            }
        }
        return objects;
    }
}