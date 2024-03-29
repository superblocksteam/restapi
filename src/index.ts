import {
  DatasourceMetadataDto,
  ExecutionOutput,
  IntegrationError,
  makeCurlString,
  paramHasKeyValue,
  Property,
  RawRequest,
  RestApiActionConfiguration,
  RestApiDatasourceConfiguration,
  RestApiFields,
  REST_API_DEFAULT_USER_AGENT
} from '@superblocksteam/shared';
import { ApiPlugin, PluginExecutionProps, updateRequestBody } from '@superblocksteam/shared-backend';
import { AxiosRequestConfig, Method } from 'axios';

export default class RestApiPlugin extends ApiPlugin {
  async execute({
    context,
    datasourceConfiguration,
    actionConfiguration
  }: PluginExecutionProps<RestApiDatasourceConfiguration>): Promise<ExecutionOutput> {
    let url: URL;
    let headers = {};

    if (!actionConfiguration.path) {
      throw new IntegrationError(`API host url not provided for REST API step`);
    }

    try {
      url = new URL(actionConfiguration.path);
    } catch (err) {
      throw new IntegrationError(`API host url not provided, ${err.message}`);
    }

    if (actionConfiguration.params) {
      actionConfiguration.params.filter(paramHasKeyValue).forEach((param) => {
        url.searchParams.append(param.key, param.value);
      });
    }

    try {
      const headerList = actionConfiguration.headers;
      if (headerList) {
        headers = headerList.reduce<Record<string, unknown>>((o: Record<string, unknown>, p: Property, _i: number, _ps: Property[]) => {
          if (!p || !p?.key) return o;
          if (!Object.prototype.hasOwnProperty.call(o, p?.key)) {
            o[p.key] = p.value;
          }
          return o;
        }, {});
      }
    } catch (err) {
      throw new IntegrationError(`Headers failed to transform, ${err.message}`);
    }

    if (!actionConfiguration.httpMethod) {
      throw new IntegrationError('No HTTP method specified for REST API step');
    }

    // Set User-Agent if it's not set by user.
    // With the latest RestApi template, newly created RestApi action has 'User-Agent' by default,
    // the following lines are still required for existing RestApi actions
    if (
      !Object.keys(headers).some((k) => {
        return 'user-agent' === k.toLowerCase();
      })
    ) {
      headers['User-Agent'] = REST_API_DEFAULT_USER_AGENT;
    }

    // TODO: Refactor and reuse the generateRequestConfig function from ApiPlugin
    const options: AxiosRequestConfig = {
      url: url.toString(),
      // request arraybuffer and let extractResponseData figure out the correct data type for the response body
      responseType: 'arraybuffer',
      method: actionConfiguration.httpMethod.toString() as Method,
      headers: headers,
      timeout: this.pluginConfiguration.restApiExecutionTimeoutMs,
      maxBodyLength: this.pluginConfiguration.restApiMaxContentLengthBytes,
      maxContentLength: this.pluginConfiguration.restApiMaxContentLengthBytes
    };

    updateRequestBody({
      actionConfiguration: actionConfiguration,
      headers: headers,
      options: options
    });

    return await this.executeRequest(options, actionConfiguration.responseType);
  }

  getRequest(actionConfiguration: RestApiActionConfiguration): RawRequest {
    return makeCurlString({
      reqMethod: actionConfiguration.httpMethod,
      reqUrl: actionConfiguration.path,
      reqHeaders: actionConfiguration.headers,
      reqParams: actionConfiguration.params,
      reqBody: actionConfiguration.body,
      reqFormData: actionConfiguration.formData,
      reqBodyType: actionConfiguration.bodyType,
      reqFileFormKey: actionConfiguration.fileFormKey,
      reqFileName: actionConfiguration.fileName
    });
  }

  dynamicProperties(): string[] {
    return [
      RestApiFields.PATH,
      RestApiFields.PARAMS,
      RestApiFields.HEADERS,
      RestApiFields.BODY_TYPE,
      RestApiFields.BODY,
      RestApiFields.FORM_DATA,
      RestApiFields.FILE_NAME,
      RestApiFields.FILE_FORM_KEY
    ];
  }

  escapeStringProperties(): string[] {
    return [RestApiFields.BODY];
  }

  async metadata(datasourceConfiguration: RestApiDatasourceConfiguration): Promise<DatasourceMetadataDto> {
    return {};
  }

  async test(datasourceConfiguration: RestApiDatasourceConfiguration): Promise<void> {
    return;
  }
}
