import fs from 'fs';
import path from 'path';
import { remote } from 'electron';
import { cloneDeep, trim } from 'lodash';
import csvStringify from 'csv-stringify';
import { clipboard } from 'electron';
import { getCurrentDBConn, getDBConnByName } from './connections';
import { rowsValuesToString } from '../utils/convert';
import wait from '../utils/wait';


export const NEW_QUERY = 'NEW_QUERY';
export const SELECT_QUERY = 'SELECT_QUERY';
export const REMOVE_QUERY = 'REMOVE_QUERY';
export const EXECUTE_QUERY_REQUEST = 'EXECUTE_QUERY_REQUEST';
export const EXECUTE_QUERY_SUCCESS = 'EXECUTE_QUERY_SUCCESS';
export const EXECUTE_QUERY_FAILURE = 'EXECUTE_QUERY_FAILURE';
export const COPY_QUERY_RESULT_TO_CLIPBOARD_REQUEST = 'COPY_QUERY_RESULT_TO_CLIPBOARD_REQUEST';
export const COPY_QUERY_RESULT_TO_CLIPBOARD_SUCCESS = 'COPY_QUERY_RESULT_TO_CLIPBOARD_SUCCESS';
export const COPY_QUERY_RESULT_TO_CLIPBOARD_FAILURE = 'COPY_QUERY_RESULT_TO_CLIPBOARD_FAILURE';
export const SAVE_QUERY_REQUEST = 'SAVE_QUERY_REQUEST';
export const SAVE_QUERY_SUCCESS = 'SAVE_QUERY_SUCCESS';
export const SAVE_QUERY_FAILURE = 'SAVE_QUERY_FAILURE';
export const UPDATE_QUERY = 'UPDATE_QUERY';


export function newQuery (database) {
  return { type: NEW_QUERY, database };
}


export function selectQuery (id) {
  return { type: SELECT_QUERY, id };
}


export function removeQuery (id) {
  return { type: REMOVE_QUERY, id };
}


export function executeQueryIfNeeded (query) {
  return (dispatch, getState) => {
    if (shouldExecuteQuery(query, getState())) {
      return dispatch(executeQuery(query));
    }
  };
}


export function executeDefaultSelectQueryIfNeeded (database, table) {
  return async (dispatch, getState) => {
    const currentState = getState();
    const dbConn = getDBConnByName(database);
    const queryDefaultSelect = await dbConn.getQuerySelectTop(table);

    if (!shouldExecuteQuery(queryDefaultSelect, currentState)) {
      return;
    }

    const currentQuery = getCurrentQuery(currentState);
    if (currentQuery && currentQuery.query !== queryDefaultSelect && trim(currentQuery.query) !== '') {
      dispatch({ type: NEW_QUERY, database });
    }

    dispatch(executeQuery(queryDefaultSelect, true, dbConn));
  };
}


export function updateQuery (query) {
  return { type: UPDATE_QUERY, query };
}


export function copyToClipboard (rows, type) {
  return async dispatch => {
    dispatch({ type: COPY_QUERY_RESULT_TO_CLIPBOARD_REQUEST });
    try {
      let value;
      if (type === 'CSV') {
        value = await stringifyResultToCSV(rows);
      } else {
        // force the next dispatch be separately
        // handled of the previous one
        await wait(0);
        value = JSON.stringify(rows, null, 2);
      }
      clipboard.writeText(value);
      dispatch({ type: COPY_QUERY_RESULT_TO_CLIPBOARD_SUCCESS });
    } catch (error) {
      dispatch({ type: COPY_QUERY_RESULT_TO_CLIPBOARD_FAILURE, error });
    }
  };
}


export function saveQuery () {
  return async (dispatch, getState) => {
    dispatch({ type: SAVE_QUERY_REQUEST });
    try {
      const currentQuery = getCurrentQuery(getState());

      let filename = (currentQuery.filename || await showSaveDialog());
      if (path.extname(filename) !== '.sql') {
        filename += '.sql';
      }

      await saveFile(filename, currentQuery.query);
      const name = path.basename(filename, '.sql');

      dispatch({ type: SAVE_QUERY_SUCCESS, name, filename });
    } catch (error) {
      dispatch({ type: SAVE_QUERY_FAILURE, error });
    }
  };
}


function shouldExecuteQuery (query, state) {
  const currentQuery = getCurrentQuery(state);
  if (!currentQuery) return true;
  if (currentQuery.isExecuting) return false;
  return true;
}


function executeQuery (query, isDefaultSelect = false, dbConnection) {
  return async (dispatch, getState) => {
    dispatch({ type: EXECUTE_QUERY_REQUEST, query, isDefaultSelect });
    try {
      const dbConn = dbConnection || getCurrentDBConn(getState());
      const remoteResult = await dbConn.executeQuery(query);

      // Remove any "reference" to the remote IPC object
      const results = cloneDeep(remoteResult);

      dispatch({ type: EXECUTE_QUERY_SUCCESS, query, results });
    } catch (error) {
      dispatch({ type: EXECUTE_QUERY_FAILURE, query, error });
    }
  };
}


function stringifyResultToCSV(rows) {
  if (!rows.length) {
    return '';
  }

  const header = Object.keys(rows[0]).reduce((_header, col) => {
    _header[col] = col;
    return _header;
  }, {});

  const data = [
    header,
    ...rowsValuesToString(rows),
  ];

  return new Promise((resolve, reject) => {
    csvStringify(data, function(err, csv) {
      if (err) { return reject(err); }
      resolve(csv);
    });
  });
}


function getCurrentQuery(state) {
  return state.queries.queriesById[state.queries.currentQueryId];
}

function showSaveDialog() {
  return new Promise(resolve => {
    remote.dialog.showSaveDialog({
      filters: [
        { name: 'SQL', extensions: ['sql'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    }, resolve);
  });
}


function saveFile(filename, data) {
  return new Promise((resolve, reject) => {
    fs.writeFile(filename, data, 'utf8', (err) => {
      if (err) { return reject(err); }
      resolve();
    });
  });
}

