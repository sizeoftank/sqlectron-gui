import * as types from '../actions/connections';
import * as serverTypes from '../actions/servers';


const INITIAL_STATE = {
  connected: false,
  connecting: false,
  server: null,
  databases: [], // connected databases
};


export default function(state = INITIAL_STATE, action) {
  switch (action.type) {
  case types.CONNECTION_REQUEST: {
    return { ...INITIAL_STATE, server: action.server };
  }
  case types.CONNECTION_SUCCESS: {
    return {
      ...state,
      connected: true,
      connecting: false,
      databases: [
        ...state.databases,
        action.database,
      ],
    };
  }
  case types.CONNECTION_FAILURE: {
    return { ...state, connected: false, connecting: false, error: action.error };
  }
  case types.TEST_CONNECTION_REQUEST: {
    const { server } = action;
    return { testConnected: false, testConnecting: true, testServer: server };
  }
  case types.TEST_CONNECTION_SUCCESS: {
    if (!_isSameTestConnection(state, action)) return state;
    return { ...state, testConnected: true, testConnecting: false };
  }
  case types.TEST_CONNECTION_FAILURE: {
    if (!_isSameTestConnection(state, action)) return state;
    return { ...state, testConnected: false, testConnecting: false, testError: action.error };
  }
  case types.CLOSE_CONNECTION:
  case serverTypes.START_EDITING_SERVER:
  case serverTypes.FINISH_EDITING_SERVER: {
    return INITIAL_STATE;
  }

  default : return state;
  }
}


function _isSameTestConnection (state, action) {
  return state.testServer === action.server;
}
