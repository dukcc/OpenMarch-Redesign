import { ipcMain } from 'electron';
import Database from 'better-sqlite3';
import path from 'path';
import { Constants } from '../../src/Constants';
import * as Interfaces from '../../src/Interfaces';
import * as fs from 'fs';
import * as History from './database.history';
import { FieldProperties } from '../../src/Interfaces';

interface DatabaseResponse {
    success: boolean;
    result?: any;
    errorMessage?: string;
}

/* ============================ COORDINATES ============================ */
// The "origin" of a football field is on the 50 yard line on the front hash. This is the pixel position on the canvas.
export const V1_ORIGIN = { x: 800, y: 520 };
/**
 * A list of properties for a college football field. Each property is in steps. For pixels, multiply by pixelsPerStep.
 */
export const V1_COLLEGE_PROPERTIES: FieldProperties = {
    frontSideline: 32,
    frontHash: 0,
    backHash: -20,
    backSideline: -52,
    originX: V1_ORIGIN.x,
    originY: V1_ORIGIN.y,
    pixelsPerStep: 10,
    roundFactor: 20, // 1/x. 4 -> nearest .25, 2 -> nearest .5, 10 -> nearest .1, 100 -> nearest .01
    width: 1600,
    height: 840,
    stepsBetweenLines: 8
};

const CURRENT_FIELD_PROPERTIES = V1_COLLEGE_PROPERTIES;

/* ============================ DATABASE ============================ */
var DB_PATH = '';

/**
 * Change the location of the database file the application and actively updates.
 *
 * @param path the path to the database file
 * @returns 200 if successful, -1 if the file does not exist
 */
export function setDbPath(path: string, isNewFile = false) {
    if (!fs.existsSync(path) && !isNewFile) {
        console.error(`setDbPath: File does not exist at path: ${path}`);
        DB_PATH = '';
        return -1;
    }
    DB_PATH = path;
    return 200;
}

export function getDbPath() {
    return DB_PATH;
}

export function databaseIsReady() {
    return DB_PATH.length > 0 && fs.existsSync(DB_PATH);
}

/**
 * Initiates the database by creating the tables if they do not exist.
 */
export function initDatabase() {
    const db = connect();
    console.log(db);
    console.log('Creating database...');
    if (!db) return;
    createMarcherTable(db);
    createPageTable(db);
    createMarcherPageTable(db);
    createFieldProperties(db, CURRENT_FIELD_PROPERTIES);
    History.createHistoryTables(db);
    console.log('Database created.');
    db.close();
}

export function connect() {
    try {
        const dbPath = DB_PATH.length > 0 ? DB_PATH : path.resolve(__dirname, '../../', 'electron/database/', 'database.db');
        return Database(dbPath, { verbose: console.log });
    } catch (error: any) {
        throw new Error('Failed to connect to database:\
        PLEASE RUN \'node_modules/.bin/electron-rebuild -f -w better-sqlite3\' to resolve this', error);
    }
}

function createMarcherTable(db: Database.Database) {
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS "${Constants.MarcherTableName}" (
                "id"	INTEGER PRIMARY KEY AUTOINCREMENT,
                "id_for_html"	TEXT UNIQUE,
                "name"	TEXT,
                "section"	TEXT NOT NULL,
                "year"	INTEGER,
                "notes"	TEXT,
                "drill_prefix"	TEXT NOT NULL,
                "drill_order"	INTEGER NOT NULL,
                "drill_number"	TEXT UNIQUE NOT NULL,
                "created_at"	TEXT NOT NULL,
                "updated_at"	TEXT NOT NULL,
                UNIQUE ("drill_prefix", "drill_order")
            );
        `);
    } catch (error) {
        console.error('Failed to create marcher table:', error);
    }
    console.log('Marcher table created.');
}

function createPageTable(db: Database.Database) {
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS "${Constants.PageTableName}" (
                "id"	INTEGER PRIMARY KEY AUTOINCREMENT,
                "id_for_html"	TEXT UNIQUE,
                "name"	TEXT NOT NULL UNIQUE,
                "notes"	TEXT,
                "order"	INTEGER NOT NULL UNIQUE,
                "tempo"	REAL NOT NULL,
                "time_signature"	TEXT,
                "counts"	INTEGER NOT NULL,
                "created_at"	TEXT NOT NULL,
                "updated_at"	TEXT NOT NULL
            );
        `);
    } catch (error) {
        console.error('Failed to create page table:', error);
    }
}

function createMarcherPageTable(db: Database.Database) {
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS "${Constants.MarcherPageTableName}" (
                "id" INTEGER PRIMARY KEY AUTOINCREMENT,
                "id_for_html" TEXT UNIQUE,
                "marcher_id" INTEGER NOT NULL,
                "page_id" INTEGER NOT NULL,
                "x" REAL,
                "y" REAL,
                "created_at" TEXT NOT NULL,
                "updated_at" TEXT NOT NULL,
                "notes" TEXT
            );
            CREATE INDEX IF NOT EXISTS "index_marcher_pages_on_marcher_id" ON "marcher_pages" ("marcher_id");
            CREATE INDEX IF NOT EXISTS "index_marcher_pages_on_page_id" ON "marcher_pages" ("page_id");
        `);
    } catch (error) {
        console.error('Failed to create marcher_page table:', error);
    }
}

function createFieldProperties(db: Database.Database, fieldProperties: Interfaces.FieldProperties) {
    try {
        db.exec(`
            CREATE TABLE IF NOT EXISTS "${Constants.FieldPropertiesTableName}" (
                id INTEGER PRIMARY KEY,
                frontSideline REAL NOT NULL,
                frontHash REAL NOT NULL,
                backHash REAL NOT NULL,
                backSideline REAL NOT NULL,
                originX REAL NOT NULL,
                originY REAL NOT NULL,
                pixelsPerStep REAL NOT NULL,
                width REAL NOT NULL,
                height REAL NOT NULL,
                stepsBetweenLines REAL NOT NULL
            );
        `);
    } catch (error) {
        console.error('Failed to create field properties table:', error);
    }
    db.exec(`
        INSERT INTO ${Constants.FieldPropertiesTableName} (
            id,
            frontSideline,
            frontHash,
            backHash,
            backSideline,
            originX,
            originY,
            pixelsPerStep,
            width,
            height,
            stepsBetweenLines
        ) VALUES (
            1,
            ${fieldProperties.frontSideline},
            ${fieldProperties.frontHash},
            ${fieldProperties.backHash},
            ${fieldProperties.backSideline},
            ${fieldProperties.originX},
            ${fieldProperties.originY},
            ${fieldProperties.pixelsPerStep},
            ${fieldProperties.width},
            ${fieldProperties.height},
            ${fieldProperties.stepsBetweenLines}
        );
    `);
    console.log('Field properties table created.');
}

/* ============================ Handlers ============================ */
/**
 * Handlers for the app api.
 * Whenever modifying this, you must also modify the app api in electron/preload/index.ts
 */
export function initHandlers() {
    // Field properties
    ipcMain.handle('field_properties:get', async () => getFieldProperties());

    // File IO handlers located in electron/main/index.ts

    // Marcher
    ipcMain.handle('marcher:getAll', async () => getMarchers());
    ipcMain.handle('marcher:insert', async (_, args) => createMarcher(args));
    ipcMain.handle('marcher:update', async (_, args) => updateMarchers(args));
    ipcMain.handle('marcher:delete', async (_, marcher_id) => deleteMarcher(marcher_id));

    // Page
    ipcMain.handle('page:getAll', async () => getPages());
    ipcMain.handle('page:insert', async (_, args) => createPages(args));
    ipcMain.handle('page:update', async (_, args) => updatePages(args));
    ipcMain.handle('page:delete', async (_, page_id) => deletePage(page_id));

    // MarcherPage
    ipcMain.handle('marcher_page:getAll', async (_, args) => getMarcherPages(args));
    ipcMain.handle('marcher_page:get', async (_, args) => getMarcherPage(args));
    ipcMain.handle('marcher_page:update', async (_, args) => updateMarcherPages(args));
    // Batch actions
    ipcMain.handle('page:setAllCoordsToPreviousPage', (_, currentPageId, previousPageId) => setAllCoordsToPreviousPage(currentPageId));

}

/* ======================= Exported Functions ======================= */
// From the history file
export async function historyAction(type: 'undo' | 'redo', db?: Database.Database) {
    return await History.historyAction(type, db);
}

/* ======================== Field Properties ======================== */
/**
 * Gets the field properties from the database.
 *
 * @param db
 * @returns
 */
export async function getFieldProperties(db?: Database.Database): Promise<Interfaces.FieldProperties> {
    const dbToUse = db || connect();
    const stmt = dbToUse.prepare(`SELECT * FROM ${Constants.FieldPropertiesTableName}`);
    const result = await stmt.get() as Interfaces.FieldProperties;
    if (!db) dbToUse.close();
    return result;
};


/* ============================ Marcher ============================ */
async function getMarchers(db?: Database.Database): Promise<Interfaces.Marcher[]> {
    const dbToUse = db || connect();
    const stmt = dbToUse.prepare(`SELECT * FROM ${Constants.MarcherTableName}`);
    const result = await stmt.all();
    if (!db) dbToUse.close();
    return result as Interfaces.Marcher[];
}

async function getMarcher(marcherId: number, db?: Database.Database): Promise<Interfaces.Marcher> {
    const dbToUse = db || connect();
    const stmt = dbToUse.prepare(`SELECT * FROM ${Constants.MarcherTableName} WHERE id = @marcherId`);
    const result = await stmt.get({ marcherId });
    if (!db) dbToUse.close();
    return result as Interfaces.Marcher;
}

async function createMarcher(newMarcher: Interfaces.NewMarcher) {
    return createMarchers([newMarcher]);
}

/**
 * Updates a list of marchers with the given values.
 *
 * @param newMarchers
 * @returns - {success: boolean, errorMessage?: string}
 */
async function createMarchers(newMarchers: Interfaces.NewMarcher[]): Promise<DatabaseResponse> {
    const db = connect();
    let output: DatabaseResponse = { success: true };

    // List of queries executed in this function to be added to the history table
    // const historyQueries: History.historyQuery[] = [];
    try {
        for (const newMarcher of newMarchers) {
            const marcherToAdd: Interfaces.Marcher = {
                id: 0, // Not used, needed for interface
                id_for_html: '', // Not used, needed for interface
                name: newMarcher.name || '',
                section: newMarcher.section,
                drill_number: newMarcher.drill_prefix + newMarcher.drill_order,
                drill_prefix: newMarcher.drill_prefix,
                drill_order: newMarcher.drill_order
            };
            const db = connect();
            const insertStmt = db.prepare(`
                INSERT INTO ${Constants.MarcherTableName} (
                    name,
                    section,
                    drill_prefix,
                    drill_order,
                    drill_number,
                    created_at,
                    updated_at
                ) VALUES (
                    @name,
                    @section,
                    @drill_prefix,
                    @drill_order,
                    @drill_number,
                    @created_at,
                    @updated_at
                )
            `);
            const created_at = new Date().toISOString();
            const insertResult = insertStmt.run({
                ...marcherToAdd,
                created_at,
                updated_at: created_at
            });

            // Get the id of the inserted row
            const id = insertResult.lastInsertRowid as number;

            // Update the id_for_html field
            const updateStmt = db.prepare(`
                UPDATE ${Constants.MarcherTableName}
                SET id_for_html = @id_for_html
                WHERE id = @id
            `);
            const updateResult = updateStmt.run({
                id_for_html: Constants.MarcherPrefix + "_" + id,
                id
            });

            // Add the page to the history table
            // historyQueries.push({
            //     action: 'DELETE',
            //     tableName: Constants.MarcherTableName,
            //     obj: { id }
            // });

            /* Add a marcherPage for this marcher for each page */
            // Get all existing pages
            const pages = await getPages(db);

            // For each page, create a new MarcherPage
            for (const page of pages) {
                createMarcherPage(db, { marcher_id: id, page_id: page.id, x: 100, y: 100 });

                // Add the marcherPage to the history table
                // historyQueries.push({
                //     action: 'DELETE',
                //     tableName: Constants.MarcherPageTableName,
                //     obj: { marcher_id: id, page_id: page.id }
                // });
            }
        }
    } catch (error: any) {
        console.error(error);
        output = { success: false, errorMessage: error.message };
    } finally {
        db.close();
        return output;
    }
}

/**
 * Update a list of marchers with the given values.
 *
 * @param marcherUpdates Array of UpdateMarcher objects that contain the id of the
 *                    marcher to update and the values to update it with
 * @returns - {success: boolean, errorMessage: string}
 */
async function updateMarchers(marcherUpdates: Interfaces.UpdateMarcher[]): Promise<DatabaseResponse> {
    const db = connect();
    let output: DatabaseResponse = { success: true };

    // List of queries executed in this function to be added to the history table
    const historyActions: History.UpdateHistoryEntry[] = [];
    // List of properties to exclude
    const excludedProperties = ['id'];

    try {
        for (const marcherUpdate of marcherUpdates) {
            // Generate the SET clause of the SQL query
            let setClause = Object.keys(marcherUpdate)
                .filter(key => !excludedProperties.includes(key))
                .map(key => `${key} = @${key}`)
                .join(', ');

            // Check if the SET clause is empty
            if (setClause.length === 0) {
                throw new Error('No valid properties to update');
            }
            // Record the original values of the marcher
            const originalMarcher = await getMarcher(marcherUpdate.id, db);

            const stmt = db.prepare(`
                UPDATE ${Constants.MarcherTableName}
                SET ${setClause}, updated_at = @new_updated_at
                WHERE id = @id
            `);

            stmt.run({ ...marcherUpdate, new_updated_at: new Date().toISOString() });

            historyActions.push({
                tableName: Constants.MarcherTableName,
                setClause: setClause,
                previousState: originalMarcher,
                reverseAction: {
                    tableName: Constants.MarcherTableName,
                    setClause: setClause,
                    previousState: await getMarcher(marcherUpdate.id, db)
                }
            });
        }
        History.insertUpdateHistory(historyActions, db);
    } catch (error: any) {
        console.error(error);
        output = { success: false, errorMessage: error.message };
    } finally {
        db.close();
        return output;
    }
}

/**
 * CAUTION - this will delete all of the marcherPages associated with the marcher.
 * THIS CANNOT BE UNDONE.
 *
 * Deletes the marcher with the given id and all of their marcherPages.
 *
 * @param marcher_id
 * @returns {success: boolean, errorMessage?: string}
 */
async function deleteMarcher(marcher_id: number): Promise<DatabaseResponse> {
    const db = connect();
    let output: DatabaseResponse = { success: true };
    try {
        const marcherStmt = db.prepare(`
            DELETE FROM ${Constants.MarcherTableName}
            WHERE id = @marcher_id
        `);
        marcherStmt.run({ marcher_id });

        const marcherPageStmt = db.prepare(`
            DELETE FROM ${Constants.MarcherPageTableName}
            WHERE marcher_id = @marcher_id
        `);
        marcherPageStmt.run({ marcher_id });
    }
    catch (error: any) {
        console.error(error);
        output = { success: false, errorMessage: error.message };
    }
    finally {
        db.close();
        return output;
    }
}

/* ============================ Page ============================ */
async function getPages(db?: Database.Database): Promise<Interfaces.Page[]> {
    const dbToUse = db || connect();
    const stmt = dbToUse.prepare(`SELECT * FROM ${Constants.PageTableName}`);
    const result = await stmt.all();
    if (!db) dbToUse.close();
    return result as Interfaces.Page[];
}

async function getPage(pageId: number, db?: Database.Database): Promise<Interfaces.Page> {
    const dbToUse = db || connect();
    const stmt = dbToUse.prepare(`SELECT * FROM ${Constants.PageTableName} WHERE id = @pageId`);
    const result = await stmt.get({ pageId });
    if (!db) dbToUse.close();
    return result as Interfaces.Page;
}

/**
 * Returns the previous page in the order of pages.
 *
 * @param pageId
 * @param db
 * @returns The page prior to the page with the given id. Null if the page is the first page.
 */
export async function getPreviousPage(pageId: number, db?: Database.Database): Promise<Interfaces.Page> {
    const dbToUse = db || connect();
    const currentOrder = (await getPage(pageId, dbToUse)).order;

    const stmt = dbToUse.prepare(`
        SELECT *
        FROM pages
        WHERE "order" < @currentOrder
        ORDER BY "order" DESC
        LIMIT 1
    `);

    const result = await stmt.get({ currentOrder }) as Interfaces.Page;
    if (!db) dbToUse.close();
    return result as Interfaces.Page || null;

}

async function createPages(newPages: Interfaces.NewPage[]): Promise<DatabaseResponse> {
    const db = connect();
    let output: DatabaseResponse = { success: true };

    // List of queries executed in this function to be added to the history table
    // const historyQueries: History.InsertHistoryEntry[] = [];

    try {
        for (const newPage of newPages) {
            // Get the max order
            const stmt = db.prepare(`SELECT MAX("order") as maxOrder FROM ${Constants.PageTableName}`);
            const result: any = stmt.get();
            const newOrder = result.maxOrder + 1;
            const pageToAdd: Interfaces.Page = {
                id: 0, // Not used, needed for interface
                id_for_html: '', // Not used, needed for interface
                name: newPage.name || '',
                notes: newPage.notes || '',
                order: newOrder,
                tempo: newPage.tempo,
                time_signature: newPage.time_signature,
                counts: newPage.counts
            };
            const insertStmt = db.prepare(`
                INSERT INTO ${Constants.PageTableName} (
                    name,
                    notes,
                    "order",
                    tempo,
                    time_signature,
                    counts,
                    created_at,
                    updated_at
                ) VALUES (
                    @name,
                    @notes,
                    @order,
                    @tempo,
                    @time_signature,
                    @counts,
                    @created_at,
                    @updated_at
                )
            `);
            const created_at = new Date().toISOString();
            const insertResult = insertStmt.run({
                ...pageToAdd,
                created_at,
                updated_at: created_at
            });
            // Get the id of the inserted row
            const id = insertResult.lastInsertRowid as number;
            // Update the id_for_html field
            const updateStmt = db.prepare(`
                UPDATE ${Constants.PageTableName}
                SET id_for_html = @id_for_html
                WHERE id = @id
            `);
            const new_id_for_html = Constants.PagePrefix + '_' + id;
            const updateResult = updateStmt.run({
                id_for_html: new_id_for_html,
                id
            });

            // // Add the page to the history table
            // historyQueries.push({
            //     tableName: Constants.PageTableName,
            //     id: id,
            //     reverseAction: {
            //         tableName: Constants.PageTableName,
            //         previousState: await getPage(id, db)
            //     }
            // });

            // Add a marcherPage for this page for each marcher
            // Get all existing marchers
            const marchers = await getMarchers();
            // For each marcher, create a new MarcherPage
            for (const marcher of marchers) {
                const previousMarcherPageCoords = await getCoordsOfPreviousPage(marcher.id, id);
                createMarcherPage(db, {
                    marcher_id: marcher.id,
                    page_id: id,
                    x: previousMarcherPageCoords?.x || 100,
                    y: previousMarcherPageCoords?.y || 100
                });

                // Add the marcherPage to the history table
                // historyQueries.push({
                //     action: 'DELETE',
                //     tableName: Constants.MarcherPageTableName,
                //     obj: { marcher_id: marcher.id, page_id: id }
                // });
            }
        }

    } catch (error: any) {
        console.error(error);
        output = { success: false, result: error.message };
    } finally {
        db.close();
        return output;
    }
}

/**
 * Update a list of pages with the given values.
 *
 * @param pageUpdates Array of UpdatePage objects that contain the id of the
 *                    page to update and the values to update it with
 * @returns - {success: boolean, errorMessage?: string}
 */
async function updatePages(pageUpdates: Interfaces.UpdatePage[]): Promise<DatabaseResponse> {
    const db = connect();
    let output: DatabaseResponse = { success: true };

    // List of queries executed in this function to be added to the history table
    const historyActions: History.UpdateHistoryEntry[] = [];
    // List of properties to exclude
    const excludedProperties = ['id'];

    try {
        for (const pageUpdate of pageUpdates) {
            // Generate the SET clause of the SQL query
            let setClause = Object.keys(pageUpdate)
                .filter(key => !excludedProperties.includes(key))
                .map(key => `${key} = @${key}`)
                .join(', ');

            // Check if the SET clause is empty
            if (setClause.length === 0) {
                console.error('No valid properties to update');
                continue;
            }

            // Record the original values of the page
            const originalPage = await getPage(pageUpdate.id, db);
            // Update the page
            const stmt = db.prepare(`
                UPDATE ${Constants.PageTableName}
                SET ${setClause}, updated_at = @new_updated_at
                WHERE id = @id
            `);
            stmt.run({ ...pageUpdate, new_updated_at: new Date().toISOString() });

            historyActions.push({
                tableName: Constants.PageTableName,
                setClause: setClause,
                previousState: originalPage,
                reverseAction: {
                    tableName: Constants.PageTableName,
                    setClause: setClause,
                    previousState: await getPage(pageUpdate.id, db)
                }
            });

        }
        History.insertUpdateHistory(historyActions, db);
    } catch (error: any) {
        console.error(error);
        output = { success: false, errorMessage: error.message };
    } finally {
        db.close();
        return output;
    }
}

/**
 * CAUTION - this will delete all of the marcherPages associated with the page.
 * THIS CANNOT BE UNDONE.
 *
 * Deletes the page with the given id and all of its marcherPages.
 *
 * @param page_id
 * @returns {success: boolean, errorMessage?: string}
 */
async function deletePage(page_id: number): Promise<DatabaseResponse> {
    const db = connect();
    let output: DatabaseResponse = { success: true };
    try {
        const pageStmt = db.prepare(`
            DELETE FROM ${Constants.PageTableName}
            WHERE id = @page_id
        `);
        pageStmt.run({ page_id });

        const marcherPageStmt = db.prepare(`
            DELETE FROM ${Constants.MarcherPageTableName}
            WHERE page_id = @page_id
        `);
        marcherPageStmt.run({ page_id });
    }
    catch (error: any) {
        console.error(error);
        output = { success: false, errorMessage: error.message };
    }
    finally {
        db.close();
        return output;
    }
}

/* ============================ MarcherPage ============================ */
/**
 * Gets all of the marcherPages, or the marcherPages with the given marcher_id or page_id.
 *
 * @param args { marcher_id?: number, page_id?: number}
 * @returns Array of marcherPages
 */
async function getMarcherPages(args: { marcher_id?: number, page_id?: number }): Promise<Interfaces.MarcherPage[]> {
    const db = connect();
    let stmt = db.prepare(`SELECT * FROM ${Constants.MarcherPageTableName}`);
    if (args) {
        if (args.marcher_id && args.page_id)
            stmt = db.prepare(`SELECT * FROM ${Constants.MarcherPageTableName} WHERE marcher_id = ${args.marcher_id} AND page_id = ${args.page_id}`);
        else if (args.marcher_id)
            stmt = db.prepare(`SELECT * FROM ${Constants.MarcherPageTableName} WHERE marcher_id = ${args.marcher_id}`);
        else if (args.page_id)
            stmt = db.prepare(`SELECT * FROM ${Constants.MarcherPageTableName} WHERE page_id = ${args.page_id}`);
    }
    const result = await stmt.all();
    db.close();
    return result as Interfaces.MarcherPage[];
}

/**
 * Gets the marcherPage with the given marcher_id and page_id.
 * TODO: NOT TESTED
 *
 * @param args { marcher_id: number, page_id: number}
 * @returns The marcherPage
 */
async function getMarcherPage(args: { marcher_id: number, page_id: number }): Promise<Interfaces.MarcherPage> {
    const marcherPages = await getMarcherPages(args);
    return marcherPages[0];
}

/**
 * Adds a new marcherPage to the database.
 * NOTE - this function should only be called from createMarcher and createPage.
 * A marcherPage should not be created manually by the user.
 * ALSO NOTE - this function does not open or close the database connection.
 *
 * @param db The database connection
 * @param newMarcherPage The marcherPage to add
 * @returns
 */
async function createMarcherPage(db: Database.Database, newMarcherPage: Interfaces.UpdateMarcherPage) {
    if (!newMarcherPage.marcher_id || !newMarcherPage.page_id)
        throw new Error('MarcherPage must have marcher_id and page_id');

    const marcherPageToAdd: Interfaces.MarcherPage = {
        id: 0, // Not used, needed for interface
        id_for_html: '', // Not used, needed for interface
        marcher_id: newMarcherPage.marcher_id,
        page_id: newMarcherPage.page_id,
        x: newMarcherPage.x,
        y: newMarcherPage.y
    };
    const insertStmt = db.prepare(`
        INSERT INTO ${Constants.MarcherPageTableName} (
            marcher_id,
            page_id,
            x,
            y,
            created_at,
            updated_at
        ) VALUES (
            @marcher_id,
            @page_id,
            @x,
            @y,
            @created_at,
            @updated_at
        )
    `);
    const created_at = new Date().toISOString();
    const insertResult = insertStmt.run({
        ...marcherPageToAdd,
        created_at,
        updated_at: created_at
    });
    // Get the id of the inserted row
    const id = insertResult.lastInsertRowid;
    // Update the id_for_html field
    const updateStmt = db.prepare(`
        UPDATE ${Constants.MarcherPageTableName}
        SET id_for_html = @id_for_html
        WHERE id = @id
    `);
    const updateResult = updateStmt.run({
        id_for_html: Constants.MarcherPagePrefix + '_' + id,
        id
    });
    return updateResult;
}

/**
 * Updates a marcherPage with the given values.
 *
 * @param args UpdateMarcherPage object that contains the marcher_id and page_id of the
 *                    marcherPage to update and the values to update it with
 * @returns - {success: boolean, result: Database.result | string}
 */
async function updateMarcherPage(args: Interfaces.UpdateMarcherPage): Promise<DatabaseResponse> {
    return updateMarcherPages([args]);
}

/**
 * Updates a list of marcherPages with the given values.
 *
 * @param marcherPageUpdates: Array of UpdateMarcherPage objects that contain the marcher_id and page_id of the
 *                  marcherPage to update and the values to update it with
 * @returns - {success: boolean, result: Database.result | string}
 */
async function updateMarcherPages(marcherPageUpdates: Interfaces.UpdateMarcherPage[]): Promise<DatabaseResponse> {
    const db = connect();
    let output: DatabaseResponse = { success: true };
    const historyActions: History.UpdateHistoryEntry[] = [];
    try {
        for (const marcherPageUpdate of marcherPageUpdates) {
            // Generate the SET clause of the SQL query
            let setClause = Object.keys(marcherPageUpdate)
                .map(key => `${key} = @${key}`)
                .join(', ');

            // Check if the SET clause is empty
            if (setClause.length === 0) {
                throw new Error('No valid properties to update');
            }

            // Record the original values of the marcherPage for the history table
            const previousState = await getMarcherPage({
                marcher_id: marcherPageUpdate.marcher_id,
                page_id: marcherPageUpdate.page_id
            });

            const stmt = db.prepare(`
                UPDATE ${Constants.MarcherPageTableName}
                SET x = @x, y = @y, updated_at = @new_updated_at
                WHERE marcher_id = @marcher_id AND page_id = @page_id
            `);

            const result = await stmt.run({ ...marcherPageUpdate, new_updated_at: new Date().toISOString() });

            const updateHistoryEntry = {
                tableName: Constants.MarcherPageTableName,
                setClause: setClause,
                previousState: previousState,
                reverseAction: {
                    tableName: Constants.MarcherPageTableName,
                    setClause: setClause,
                    previousState: await getMarcherPage({
                        marcher_id: marcherPageUpdate.marcher_id,
                        page_id: marcherPageUpdate.page_id
                    }),
                }
            }

            historyActions.push(updateHistoryEntry);
        }
        History.insertUpdateHistory(historyActions, db);

        output = { success: true };
    } catch (error: any) {
        console.error(error);
        output = { success: false, errorMessage: error.message };
    } finally {
        db.close();
        return output;
    }
}

/**
 * Changes the coordinates of the marcherPage with the given marcher_id and page_id to the coordinates of the previous page.
 *
 * @param db database connection
 * @param marcher_id marcher_id of the marcher whose coordinates will change
 * @param page_id the page_id of the page that the coordinates will be updated on (not the previous page's id).
 */
async function getCoordsOfPreviousPage(marcher_id: number, page_id: number) {
    const db = connect();

    /* Get the previous marcherPage */
    const currPageStmt = db.prepare(`SELECT * FROM ${Constants.PageTableName} WHERE id = @page_id`);
    const currPage = currPageStmt.get({ page_id }) as Interfaces.Page;
    if (!currPage)
        throw new Error(`Page with id ${page_id} does not exist`);
    if (currPage.order === 1) {
        console.log(`page_id ${page_id} is the first page, skipping setCoordsToPreviousPage`);
        return;
    }
    const previousPage = await getPreviousPage(page_id, db);
    const previousMarcherPage = await getMarcherPage({ marcher_id, page_id: previousPage.id }) as Interfaces.MarcherPage;

    if (!previousPage)
        throw new Error(`Previous page with page_id ${page_id} does not exist`);

    db.close();
    return {
        x: previousMarcherPage.x,
        y: previousMarcherPage.y
    }
}

/* --------------- MarcherPage Utility Actions --------------- */
/**
 * Sets the coordinates of all marcherPages on the given page to the coordinates of the previous page.
 *
 * @param currentPageId - the id of the page to set the coordinates on
 * @param previousPageId - the id of the page to get the coordinates from. If not provided, the previous page will be found.
 * @returns {success: boolean, result: Database.result | string}
 */
export async function setAllCoordsToPreviousPage(currentPageId: number, previousPageId?: number): Promise<DatabaseResponse> {
    const dbToUse = connect();
    if (!previousPageId)
        try {
            previousPageId = (await getPreviousPage(currentPageId, dbToUse)).id;
        }
        catch (error: any) {
            console.error("setAllCoordsToPreviousPage: error likely caused by currentPage being the first page\n", error);
            return { success: false, errorMessage: "setAllCoordsToPreviousPage: error likely caused by currentPageId being the first page\n" + error.message };
        }
    const marcherPages = await getMarcherPages({ page_id: previousPageId });

    const changes: Interfaces.UpdateMarcherPage[] = [];
    for (const marcherPage of marcherPages) {
        changes.push({
            marcher_id: marcherPage.marcher_id,
            page_id: currentPageId,
            x: marcherPage.x,
            y: marcherPage.y
        });
    }

    const response = await updateMarcherPages(changes);

    return { success: true, result: response };
}

/**
 * Rounds the coordinates of the marcherPages with the given marcher_id and page_id to the nearest multiple of the denominator.
 *
 * Example: if the denominator is 10, the coordinates will be rounded to the nearest .1.
 * If the denominator is 4, the coordinates will be rounded to the nearest .25.
 *
 * @param marcherId
 * @param pageId
 * @param denominator
 * @returns
 */
export async function roundCoordinates(marcherPages: { marcherId: number, pageId: number }[], denominator: number, xAxis: boolean, yAxis: boolean): Promise<DatabaseResponse> {
    const db = connect();

    const changes: Interfaces.UpdateMarcherPage[] = [];
    const stepsPerPixel = 1 / CURRENT_FIELD_PROPERTIES.pixelsPerStep;
    for (const marcherPageArgs of marcherPages) {
        const marcherPage = await getMarcherPage({ marcher_id: marcherPageArgs.marcherId, page_id: marcherPageArgs.pageId });

        let newX = marcherPage.x;
        let newY = marcherPage.y;

        if (xAxis) {
            const xStepsFromOrigin = stepsPerPixel * (CURRENT_FIELD_PROPERTIES.originX - marcherPage.x);
            const roundedXSteps = Math.round(xStepsFromOrigin * denominator) / denominator;
            newX = CURRENT_FIELD_PROPERTIES.originX - (roundedXSteps / stepsPerPixel);
        }
        if (yAxis) {
            const yStepsFromOrigin = stepsPerPixel * (CURRENT_FIELD_PROPERTIES.originY - marcherPage.y);
            const roundedYSteps = Math.round(yStepsFromOrigin * denominator) / denominator;
            newY = CURRENT_FIELD_PROPERTIES.originY - (roundedYSteps / stepsPerPixel);
        }
        changes.push({
            marcher_id: marcherPage.marcher_id,
            page_id: marcherPage.page_id,
            // 860 pixels, 86 steps, .1 steps per pixel
            x: newX,
            y: newY
        });
    }

    const response = await updateMarcherPages(changes);

    db.close();
    return { success: true, result: response };

}
