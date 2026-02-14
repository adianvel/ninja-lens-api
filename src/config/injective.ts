import { Network, getNetworkEndpoints } from "@injectivelabs/networks";
import {
  IndexerGrpcSpotApi,
  IndexerGrpcDerivativesApi,
  IndexerGrpcAccountApi,
  IndexerGrpcOracleApi,
  ChainGrpcBankApi,
} from "@injectivelabs/sdk-ts";

const NETWORK = Network.Mainnet;
const endpoints = getNetworkEndpoints(NETWORK);

export const indexerGrpcSpotApi = new IndexerGrpcSpotApi(
  endpoints.indexer
);

export const indexerGrpcDerivativesApi = new IndexerGrpcDerivativesApi(
  endpoints.indexer
);

export const indexerGrpcAccountApi = new IndexerGrpcAccountApi(
  endpoints.indexer
);

export const indexerGrpcOracleApi = new IndexerGrpcOracleApi(
  endpoints.indexer
);

export const chainGrpcBankApi = new ChainGrpcBankApi(
  endpoints.grpc
);

export const networkEndpoints = endpoints;
export const network = NETWORK;
