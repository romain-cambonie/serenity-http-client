import type { AxiosResponse } from 'axios';
import { HttpClientError, HttpClientForbiddenError, HttpServerError } from '../errors';
import { AdapterConfig, isHttpClientError, isHttpServerError } from '../httpClient';
import type { AxiosErrorWithResponse } from './axios.adapter';
import {
  AxiosInfrastructureError,
  AxiosInfrastructureErrorCodes,
  ConnectionRefusedError,
  ConnectionResetError,
  InfrastructureError,
  isAxiosInfrastructureError,
  isTCPWrapperConnectionRefusedError,
  isTCPWrapperConnectionResetError
} from './errors';

export const toHttpError = (error: AxiosErrorWithResponse): HttpClientError | HttpServerError | undefined => {
  if (isHttpClientError(error.response.status)) {
    if (error.response.status === 401) return new HttpClientForbiddenError(`Forbidden Access`, error);

    return new HttpClientError(`${JSON.stringify(toSerializableAxiosHttpError(error), null, 2)}`, error, error.response.status);
  }

  if (isHttpServerError(error.response.status)) {
    return new HttpServerError(`${JSON.stringify(toSerializableAxiosHttpError(error), null, 2)}`, error, error.response.status);
  }

  return undefined;
};

export const toInfrastructureError = (error: Error): InfrastructureError | undefined => {
  if (isTCPWrapperConnectionRefusedError(error))
    return new ConnectionRefusedError(`Could not connect to server : ${toAxiosInfrastructureErrorString(error)}`, error);

  if (isTCPWrapperConnectionResetError(error))
    return new ConnectionResetError(
      `The other side of the TCP conversation abruptly closed its end of the connection: ${toAxiosInfrastructureErrorString(
        error
      )}`,
      error
    );

  if (isAxiosInfrastructureError(error))
    return new AxiosInfrastructureError(
      `Axios infrastructure error: ${toAxiosInfrastructureErrorString(error)}`,
      error,
      (error as unknown as { code: AxiosInfrastructureErrorCodes }).code
    );

  return undefined;
};

// TODO Do better with generic
/*
 *type PartiallyTypedSerializableAxiosHttpError = {
 *_response: {
 *  data: any,
 *  status: number,
 *  headers: AxiosResponseHeaders,
 *  requestConfig: {
 *    url: string,
 *    headers: AxiosRequestHeaders,
 *    method: string,
 *    data: any,
 *    timeout: number,
 *  },
 *  request?: object;
 *}
 *};
 */

// TODO object should be forbidden, to type better
const toSerializableAxiosHttpError = ({ response }: AxiosErrorWithResponse): object => {
  // eslint-disable-next-line @typescript-eslint/no-shadow
  const { config, data, status, headers, request }: AxiosResponse = response;

  // eslint-disable-next-line @typescript-eslint/typedef
  const axiosHttpErrorWithoutRequest = {
    /* eslint-disable-next-line @typescript-eslint/naming-convention */
    _response: {
      data,
      status,
      headers
    },
    requestConfig: {
      url: config.url,
      headers: config.headers,
      method: config.method,
      data: config.data,
      timeout: config.timeout
    }
  };

  if (request === undefined) return axiosHttpErrorWithoutRequest;

  /*
   * socket, agent, res, _redirectable are keys that cause "cyclic structure" errors.
   * If needed for debug we may want to further explore them by listing keys and displaying what can be.
   */
  // eslint-disable-next-line @typescript-eslint/typedef
  const { socket, agent, res, _redirectable, ...nonCyclicRequest } = request;
  return {
    ...axiosHttpErrorWithoutRequest,
    request: nonCyclicRequest
  };
};

type AxiosInfrastructureErrorObject = Partial<{
  code: string;
  address: string;
  port: number;
  config: {
    headers: object; // TODO object should be forbidden, to type better
    method: string;
    url: string;
    baseUrl: string;
    data: object; // TODO object should be forbidden, to type better
  };
}>;

const toAxiosInfrastructureErrorString = (error: unknown): string => {
  // TODO This is not satisfying
  const infrastructureError: AxiosInfrastructureErrorObject = error as AxiosInfrastructureErrorObject;
  return JSON.stringify(
    {
      code: infrastructureError.code,
      address: infrastructureError.address,
      port: infrastructureError.port,
      config: {
        headers: infrastructureError.config?.headers,
        method: infrastructureError.config?.method,
        url: infrastructureError.config?.url,
        baseUrl: infrastructureError.config?.baseUrl,
        data: infrastructureError.config?.data
      }
    },
    null,
    2
  );
};

export const shallowMergeConfigs = (initialConfig: AdapterConfig, additionalConfig: AdapterConfig): AdapterConfig => ({
  ...initialConfig,
  ...additionalConfig
});
