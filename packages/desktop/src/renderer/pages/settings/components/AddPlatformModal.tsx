import type { IProvider } from '@/common/config/storage';
import type { ProtocolDetectionResponse, ProtocolType } from '@/common/utils/protocolDetector';
import { ipcBridge } from '@/common';
import { uuid } from '@/common/utils';
import { isGoogleApisHost } from '@/common/utils/urlValidation';
import ModalHOC from '@/renderer/utils/ui/ModalHOC';
import { Form, Input, Message, Select, Switch } from '@arco-design/web-react';
import { LinkCloud, Edit, Search, Loading } from '@icon-park/react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import useModeModeList from '@renderer/hooks/agent/useModeModeList';
import useProtocolDetection from '@renderer/hooks/system/useProtocolDetection';
import AionModal from '@/renderer/components/base/AionModal';
import ApiKeyEditorModal from './ApiKeyEditorModal';
import {
  MODEL_PLATFORMS,
  NEW_API_PROTOCOL_OPTIONS,
  detectNewApiProtocol,
  getPlatformByValue,
  isCustomOption,
  isGeminiPlatform,
  isNewApiPlatform,
  type PlatformConfig,
} from '@/renderer/utils/model/modelPlatforms';
import type { DeepLinkAddProviderDetail } from '@/renderer/hooks/system/useDeepLink';

/**
 * Protocol icon configurations
 */
const PROTOCOL_ICONS: Record<ProtocolType, { color: string; bgColor: string }> = {
  openai: { color: '#10A37F', bgColor: 'rgba(16, 163, 127, 0.1)' },
  gemini: { color: '#4285F4', bgColor: 'rgba(66, 133, 244, 0.1)' },
  anthropic: { color: '#D97757', bgColor: 'rgba(217, 119, 87, 0.1)' },
  unknown: { color: '#9CA3AF', bgColor: 'rgba(156, 163, 175, 0.1)' },
};

/**
 * Get translated suggestion message
 */
const getSuggestionMessage = (
  suggestion: ProtocolDetectionResponse['suggestion'],
  t: (key: string, params?: Record<string, string>) => string
): string => {
  if (!suggestion) return '';

  // Use i18n key for translation if available
  if (suggestion.i18nKey) {
    const translated = t(suggestion.i18nKey, suggestion.i18nParams);
    // If translation result equals the key, translation failed, fallback to message
    if (translated !== suggestion.i18nKey) {
      return translated;
    }
  }

  // Fallback to original message
  return suggestion.message;
};

/**
 * Protocol Detection Status Component
 * Display protocol detection status, result, and suggestions
 */
interface ProtocolDetectionStatusProps {
  /** Whether detecting */
  isDetecting: boolean;
  /** Detection result */
  result: ProtocolDetectionResponse | null;
  /** Currently selected platform */
  currentPlatform?: string;
  /** Switch platform callback */
  onSwitchPlatform?: (platform: string) => void;
}

const ProtocolDetectionStatus: React.FC<ProtocolDetectionStatusProps> = ({
  isDetecting,
  result,
  currentPlatform,
  onSwitchPlatform,
}) => {
  const { t } = useTranslation();

  // Detecting
  if (isDetecting) {
    return (
      <div className='flex items-center gap-6px text-12px text-t-secondary py-4px'>
        <Loading theme='outline' size={14} className='animate-spin' />
        <span>{t('settings.protocolDetecting')}</span>
      </div>
    );
  }

  // No detection result
  if (!result) {
    return null;
  }

  const { protocol, success, suggestion, multiKeyResult } = result;
  const iconConfig = PROTOCOL_ICONS[protocol] || PROTOCOL_ICONS.unknown;

  // Detection successful
  if (success && suggestion) {
    const showSwitchButton =
      suggestion.type === 'switch_platform' &&
      suggestion.suggestedPlatform &&
      suggestion.suggestedPlatform !== currentPlatform;

    return (
      <div className='flex flex-col gap-4px py-4px'>
        <div className='flex items-start gap-8px text-12px'>
          <div className='flex items-center gap-6px flex-1 min-w-0'>
            <div
              className='flex items-center justify-center w-16px h-16px rounded-4px shrink-0'
              style={{
                backgroundColor: iconConfig.bgColor,
              }}
            >
              <span
                className='text-10px font-medium'
                style={{
                  color: iconConfig.color,
                }}
              >
                {protocol === 'openai' ? 'O' : protocol === 'gemini' ? 'G' : protocol === 'anthropic' ? 'A' : '?'}
              </span>
            </div>
            <span className='text-t-secondary truncate'>{getSuggestionMessage(suggestion, t)}</span>
          </div>

          {showSwitchButton && onSwitchPlatform && (
            <button
              type='button'
              className='shrink-0 px-8px py-2px rounded-4px text-11px font-medium transition-colors'
              style={{
                backgroundColor: iconConfig.bgColor,
                color: iconConfig.color,
              }}
              onClick={() => onSwitchPlatform(suggestion.suggestedPlatform!)}
            >
              {t('settings.switchPlatform')}
            </button>
          )}
        </div>

        {/* Multi-key test result */}
        {multiKeyResult && multiKeyResult.total > 1 && (
          <div className='flex items-center gap-6px text-11px text-t-tertiary pl-22px'>
            <span>
              {multiKeyResult.invalid === 0
                ? t('settings.multiKeyAllValid', { total: String(multiKeyResult.total) })
                : multiKeyResult.valid === 0
                  ? t('settings.multiKeyAllInvalid', { total: String(multiKeyResult.total) })
                  : t('settings.multiKeyPartialValid', {
                      valid: String(multiKeyResult.valid),
                      invalid: String(multiKeyResult.invalid),
                    })}
            </span>
          </div>
        )}
      </div>
    );
  }

  // Detection failed
  if (!success && result.error) {
    return (
      <div className='flex items-center gap-6px text-12px text-warning py-4px'>
        <div className='flex items-center justify-center w-16px h-16px rounded-4px bg-warning/10 shrink-0'>
          <span className='text-10px font-medium'>!</span>
        </div>
        <span className='truncate'>{suggestion ? getSuggestionMessage(suggestion, t) : result.error}</span>
      </div>
    );
  }

  return null;
};

/**
 * ????? Logo ???
 * Provider Logo Component
 */
const ProviderLogo: React.FC<{ logo: string | null; name: string; size?: number }> = ({ logo, name, size = 20 }) => {
  if (logo) {
    return <img src={logo} alt={name} className='object-contain shrink-0' style={{ width: size, height: size }} />;
  }
  return <LinkCloud theme='outline' size={size} className='text-t-secondary flex shrink-0' />;
};

/**
 * ???????????????????
 * Platform dropdown option renderer (first level)
 *
 * @param platform - ?????? / Platform config
 * @param t - ?????? / Translation function
 */
const renderPlatformOption = (platform: PlatformConfig, t?: (key: string) => string) => {
  // ????? i18nKey ????????????????????????????????????????
  // If i18nKey exists and t function is provided, use translated name; otherwise use original name
  const display_name = platform.i18nKey && t ? t(platform.i18nKey) : platform.name;
  return (
    <div className='flex items-center gap-8px'>
      <ProviderLogo logo={platform.logo} name={display_name} size={18} />
      <span>{display_name}</span>
    </div>
  );
};

const AddPlatformModal = ModalHOC<{
  onSubmit: (platform: IProvider) => void;
  deepLinkData?: DeepLinkAddProviderDetail;
}>(({ modalProps, onSubmit, modalCtrl, deepLinkData }) => {
  const [message, messageContext] = Message.useMessage();
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [api_keyEditorVisible, setApiKeyEditorVisible] = useState(false);
  // ?????????????????????????????????
  // Track last detection input to avoid redundant detection
  const [lastDetectionInput, setLastDetectionInput] = useState<{ base_url: string; api_key: string } | null>(null);

  const platformValue = Form.useWatch('platform', form);
  const base_url = Form.useWatch('base_url', form);
  const api_key = Form.useWatch('api_key', form);
  const modelValue = Form.useWatch('model', form);
  const bedrockAuthMethod = Form.useWatch('bedrockAuthMethod', form);
  const _bedrockRegion = Form.useWatch('bedrockRegion', form);

  // ????????????????? / Get current selected platform config
  const selectedPlatform = useMemo(() => getPlatformByValue(platformValue), [platformValue]);

  const platform = selectedPlatform?.platform ?? 'gemini';
  // ????????"?????"????????? base_url?? / Check if "Custom" option (no preset base_url)
  const isCustom = isCustomOption(platformValue);
  const isBedrock = platform === 'bedrock';
  const isDualRoute = platform === 'dual-route';
  const isGemini = isGeminiPlatform(platform);
  const isNewApi = isNewApiPlatform(platform);

  // new-api ????????????? / new-api per-model protocol selection state
  const [modelProtocol, setModelProtocol] = useState<string>('openai');
  const [isFullUrl, setIsFullUrl] = useState(false);

  // Auto-detect protocol when model changes (for new-api platforms)
  useEffect(() => {
    if (isNewApi && modelValue) {
      setModelProtocol(detectNewApiProtocol(modelValue));
    }
  }, [modelValue, isNewApi]);

  // ??????????? base_url????????????????????????????h
  // Calculate actual base_url (prefer user input, fallback to platform preset)
  const actualBaseUrl = useMemo(() => {
    if (base_url) return base_url;
    return selectedPlatform?.base_url || '';
  }, [base_url, selectedPlatform?.base_url]);

  // For Bedrock, don't pass bedrock_config to avoid auto-refresh on input changes
  // We'll build it dynamically in onFocus
  const modelListState = useModeModeList(platform, actualBaseUrl, api_key, true, undefined);

  // ?????? Hook / Protocol detection hook
  // ??????????????
  // 1. ??????? ?? ?????????????? base URL?????????????u??????
  // 2. ??????????"???????"????????????????????????
  // Enable detection when:
  // 1. Custom platform OR user entered a custom base URL (non-official, like local proxy)
  // 2. Input values differ from last "accepted suggestion" (avoid redundant detection after platform switch)
  const isNonOfficialBaseUrl = base_url && !isGoogleApisHost(base_url);
  const shouldEnableDetection = isCustom || isNonOfficialBaseUrl;
  // ??????????????????????????????????????????????
  // Only trigger detection when input changed since last accepted suggestion
  const inputChangedSinceLastSwitch =
    !lastDetectionInput || lastDetectionInput.base_url !== actualBaseUrl || lastDetectionInput.api_key !== api_key;
  const protocolDetection = useProtocolDetection(
    shouldEnableDetection && inputChangedSinceLastSwitch ? actualBaseUrl : '',
    shouldEnableDetection && inputChangedSinceLastSwitch ? api_key : '',
    {
      debounceMs: 1000,
      autoDetect: true,
      timeout: 10000,
    }
  );

  // ???????????????????? ?? (?????????????) ?? ??????????????????
  // Whether to show detection result: enabled AND (has result or detecting) AND input changed since last switch
  const shouldShowDetectionResult = shouldEnableDetection && inputChangedSinceLastSwitch;

  // ??????????????
  // Handle platform switch suggestion
  const handleSwitchPlatform = (suggestedPlatform: string) => {
    const targetPlatform = MODEL_PLATFORMS.find((p) => p.value === suggestedPlatform || p.name === suggestedPlatform);
    if (targetPlatform) {
      form.setFieldValue('platform', targetPlatform.value);
      form.setFieldValue('model', '');
      protocolDetection.reset();
      // ?????????????????????????
      // Record current input to prevent redundant detection after switch
      setLastDetectionInput({ base_url: actualBaseUrl, api_key });
      message.success(t('settings.platformSwitched', { platform: targetPlatform.name }));
    }
  };

  // ????????????? / Reset form when modal opens
  useEffect(() => {
    if (modalProps.visible) {
      form.resetFields();
      form.setFieldValue('bedrockAuthMethod', 'accessKey');
      form.setFieldValue('bedrockRegion', 'us-east-1');
      protocolDetection.reset();
      setLastDetectionInput(null); // ????????? / Reset detection record
      setModelProtocol('openai'); // ??????????? / Reset protocol selection
      setIsFullUrl(false);

      // Pre-fill from deep link data (aionui:// protocol)
      if (deepLinkData?.base_url || deepLinkData?.api_key) {
        // Default to new-api platform for deep links (typical one-api/new-api usage)
        form.setFieldValue('platform', deepLinkData.platform || 'new-api');
        if (deepLinkData.base_url) form.setFieldValue('base_url', deepLinkData.base_url);
        if (deepLinkData.api_key) form.setFieldValue('api_key', deepLinkData.api_key);
      } else {
        form.setFieldValue('platform', 'gemini');
      }
    }
  }, [modalProps.visible, deepLinkData]);

  useEffect(() => {
    if (platform?.includes('gemini')) {
      void modelListState.mutate();
    }
  }, [platform]);

  // ???????????? base_url / Handle auto-fixed base_url
  useEffect(() => {
    if (modelListState.data?.fix_base_url) {
      form.setFieldValue('base_url', modelListState.data.fix_base_url);
      message.info(t('settings.baseUrlAutoFix', { base_url: modelListState.data.fix_base_url }));
    }
  }, [modelListState.data?.fix_base_url, form]);

  const handleSubmit = () => {
    form
      .validate()
      .then((values) => {
        // ????? i18nKey ????????????????????? platform ?? name
        // If i18nKey exists use translated name, otherwise use platform name
        const name = selectedPlatform?.i18nKey
          ? t(selectedPlatform.i18nKey)
          : (selectedPlatform?.name ?? values.platform);
        const provider: IProvider = {
          id: uuid(),
          platform: selectedPlatform?.platform ?? 'custom',
          name,
          // ??????????????? base_url???????????????
          // Prefer user input base_url, fallback to platform preset
            base_url: isBedrock ? '' : isDualRoute ? (values.local_api_url || '') : values.base_url || selectedPlatform?.base_url || '',
          api_key: isBedrock ? '' : values.api_key,
          models: [values.model],
          is_full_url: isFullUrl,
        };

        // Add Bedrock configuration if platform is Bedrock
        if (isBedrock) {
          provider.bedrock_config = {
            auth_method: values.bedrockAuthMethod,
            region: values.bedrockRegion,
            ...(values.bedrockAuthMethod === 'accessKey'
              ? {
                  access_key_id: values.bedrockAccessKeyId,
                  secret_access_key: values.bedrockSecretAccessKey,
                }
              : {
                  profile: values.bedrockProfile,
                }),
          };
        }

        // new-api ???????????????????? / new-api platform: save per-model protocol config
        if (isNewApi && values.model) {
          provider.model_protocols = { [values.model]: modelProtocol };
        }

        onSubmit(provider);
        modalCtrl.close();
      })
      .catch(() => {
        // validation failed
      });
  };

  return (
    <AionModal
      visible={modalProps.visible}
      onCancel={modalCtrl.close}
      header={{ title: t('settings.addModel'), showClose: true }}
      style={{ maxWidth: '92vw', borderRadius: 16 }}
      contentStyle={{
        background: 'var(--dialog-fill-0)',
        borderRadius: 16,
        padding: '20px 24px 16px',
        overflow: 'auto',
      }}
      onOk={handleSubmit}
      confirmLoading={modalProps.confirmLoading}
      okText={t('common.confirm')}
      cancelText={t('common.cancel')}
    >
      {messageContext}
      <div className='pt-4px pb-12px'>
        <Form form={form} layout='vertical' className='[&_.arco-form-item]:mb-12px [&_.arco-form-item:last-child]:mb-0'>
          {/* ?????????????/ Model Platform Selection (first level) */}
          <Form.Item
            initialValue='gemini'
            label={t('settings.modelPlatform')}
            field={'platform'}
            required
            rules={[{ required: true }]}
          >
            <Select
              showSearch
              filterOption={(inputValue, option) => {
                const optionValue = (option as React.ReactElement<{ value?: string }>)?.props?.value;
                const plat = MODEL_PLATFORMS.find((p) => p.value === optionValue);
                return plat?.name.toLowerCase().includes(inputValue.toLowerCase()) ?? false;
              }}
              onChange={(value) => {
                const plat = MODEL_PLATFORMS.find((p) => p.value === value);
                if (plat) {
                  form.setFieldValue('model', '');
                }
              }}
              renderFormat={(option) => {
                const optionValue = (option as { value?: string })?.value;
                const plat = MODEL_PLATFORMS.find((p) => p.value === optionValue);
                if (!plat) return optionValue;
                return renderPlatformOption(plat, t);
              }}
            >
              {MODEL_PLATFORMS.map((plat) => (
                <Select.Option key={plat.value} value={plat.value}>
                  {renderPlatformOption(plat, t)}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          {/* ?????????? API / Dual Route: Local API */}
          {isDualRoute && (
            <Form.Item label={t('settings.dualRoute.localApi', 'Local API')} field={'local_api_url'} required>
              <Input placeholder={'http://127.0.0.1:1234/v1'} />
            </Form.Item>
          )}
          {/* ????????? API / Dual Route: Cloud API */}
          {isDualRoute && (
            <Form.Item label={t('settings.dualRoute.cloudApi', 'Cloud API')} field={'cloud_api_url'} required>
              <Input placeholder={'https://api.deepseek.com/v1'} />
            </Form.Item>
          )}
          {/* ????????? API Key / Dual Route: Cloud API Key */}
          {isDualRoute && (
            <Form.Item label={t('settings.dualRoute.cloudApiKey', 'Cloud API Key')} field={'cloud_api_key'} required>
              <Input placeholder={'sk-...'} />
            </Form.Item>
          )}

                    {/* Base URL - ???????????? Gemini ?? New API ??? / Base URL - for Custom, standard Gemini and New API */}
          <Form.Item
            hidden={isBedrock || isDualRoute || (!isCustom && !isNewApi && platformValue !== 'gemini')}
            label={t('settings.apiEndpoint', 'API ??????')}
            field={'base_url'}
            required={isCustom || isNewApi}
            rules={[{ required: isCustom || isNewApi }]}
          >
            <Input
              placeholder={
                isFullUrl
                  ? 'https://your-api-endpoint.com/v1/chat/completions'
                  : isNewApi
                    ? 'https://your-newapi-instance.com'
                    : selectedPlatform?.base_url || ''
              }
              onBlur={() => {
                void modelListState.mutate();
              }}
            />
          </Form.Item>

          {/*
            Full URL toggle - only for custom and new-api platforms.
            Use a positive marginTop so the Switch row sits below the Input.
            A negative marginTop would overlap the Input's bottom edge and
            intercept clicks on its lower rim (see ELECTRON-1K4).
          */}
          {(isCustom || isNewApi) && !isBedrock && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, marginBottom: 12 }}>
              <Switch size='small' checked={isFullUrl} onChange={setIsFullUrl} />
              <span className='text-12px text-t-secondary'>{t('settings.fullUrlMode', '???? URL')}</span>
              <span className='text-11px text-t-tertiary'>
                {isFullUrl
                  ? t('settings.fullUrlHint', '????????????????????')
                  : t('settings.baseUrlHint', '??????????????????')}
              </span>
            </div>
          )}

          {/* API Key */}
          <Form.Item
            hidden={isBedrock}
            label={t('settings.apiKey')}
            required={!isBedrock}
            rules={[{ required: !isBedrock }]}
            field={'api_key'}
            extra={
              <div className='space-y-2px'>
                <div className='text-11px text-t-secondary mt-2 leading-4'>{t('settings.multiApiKeyTip')}</div>
                {/* ???????? / Protocol detection status */}
                {shouldShowDetectionResult && (
                  <ProtocolDetectionStatus
                    isDetecting={protocolDetection.isDetecting}
                    result={protocolDetection.result}
                    currentPlatform={platformValue}
                    onSwitchPlatform={handleSwitchPlatform}
                  />
                )}
              </div>
            }
          >
            <Input
              onBlur={() => {
                void modelListState.mutate();
              }}
              suffix={
                <Edit
                  theme='outline'
                  size={16}
                  className='cursor-pointer text-t-secondary hover:text-t-primary flex'
                  onClick={() => setApiKeyEditorVisible(true)}
                />
              }
            />
          </Form.Item>

          {/* AWS Bedrock Authentication Method */}
          <Form.Item
            hidden={!isBedrock}
            label={t('settings.bedrock.authMethod')}
            field={'bedrockAuthMethod'}
            initialValue='accessKey'
            required={isBedrock}
            rules={[{ required: isBedrock }]}
          >
            <Select>
              <Select.Option value='accessKey'>{t('settings.bedrock.authMethodAccessKey')}</Select.Option>
              <Select.Option value='profile'>{t('settings.bedrock.authMethodProfile')}</Select.Option>
            </Select>
          </Form.Item>

          {/* AWS Region */}
          <Form.Item
            hidden={!isBedrock}
            label={t('settings.bedrock.region')}
            field={'bedrockRegion'}
            initialValue='us-east-1'
            required={isBedrock}
            rules={[{ required: isBedrock }]}
            extra={t('settings.bedrock.regionHint')}
          >
            <Select showSearch>
              <Select.Option value='us-east-1'>US East (N. Virginia)</Select.Option>
              <Select.Option value='us-west-2'>US West (Oregon)</Select.Option>
              <Select.Option value='eu-west-1'>Europe (Ireland)</Select.Option>
              <Select.Option value='eu-central-1'>Europe (Frankfurt)</Select.Option>
              <Select.Option value='ap-southeast-1'>Asia Pacific (Singapore)</Select.Option>
              <Select.Option value='ap-northeast-1'>Asia Pacific (Tokyo)</Select.Option>
              <Select.Option value='ap-southeast-2'>Asia Pacific (Sydney)</Select.Option>
              <Select.Option value='ca-central-1'>Canada (Central)</Select.Option>
            </Select>
          </Form.Item>

          {/* Access Key ID */}
          <Form.Item
            hidden={!isBedrock || bedrockAuthMethod !== 'accessKey'}
            label={t('settings.bedrock.accessKeyId')}
            field={'bedrockAccessKeyId'}
            required={isBedrock && bedrockAuthMethod === 'accessKey'}
            rules={[{ required: isBedrock && bedrockAuthMethod === 'accessKey' }]}
          >
            <Input.Password placeholder='AKIA...' visibilityToggle />
          </Form.Item>

          {/* Secret Access Key */}
          <Form.Item
            hidden={!isBedrock || bedrockAuthMethod !== 'accessKey'}
            label={t('settings.bedrock.secretAccessKey')}
            field={'bedrockSecretAccessKey'}
            required={isBedrock && bedrockAuthMethod === 'accessKey'}
            rules={[{ required: isBedrock && bedrockAuthMethod === 'accessKey' }]}
          >
            <Input.Password visibilityToggle />
          </Form.Item>

          {/* AWS Profile */}
          <Form.Item
            hidden={!isBedrock || bedrockAuthMethod !== 'profile'}
            label={t('settings.bedrock.profile')}
            field={'bedrockProfile'}
            required={isBedrock && bedrockAuthMethod === 'profile'}
            rules={[{ required: isBedrock && bedrockAuthMethod === 'profile' }]}
            extra={t('settings.bedrock.profileHint')}
          >
            <Input placeholder='default' />
          </Form.Item>

          {/* ?????? / Model Selection */}
          <Form.Item
            label={t('settings.modelName')}
            field={'model'}
            required
            rules={[{ required: true }]}
            validateStatus={!isFullUrl && modelListState.error ? 'error' : 'success'}
            help={
              !isFullUrl && modelListState.error instanceof Error
                ? modelListState.error.message
                : !isFullUrl && modelListState.error
                  ? String(modelListState.error)
                  : undefined
            }
          >
            <Select
              loading={!isFullUrl && modelListState.isLoading}
              showSearch
              allowCreate
              suffixIcon={
                isFullUrl ? undefined : (
                  <Search
                    onClick={async (e) => {
                      e.stopPropagation();
                      if ((isCustom || isNewApi) && !base_url) {
                        message.warning(t('settings.pleaseEnterBaseUrl'));
                        return;
                      }
                      // For Bedrock, build bedrock_config from current form values and fetch models
                      if (isBedrock) {
                        const values = form.getFields();
                        if (!values.bedrockAuthMethod || !values.bedrockRegion) {
                          message.warning(t('settings.bedrock.fillRequiredFields'));
                          return;
                        }
                        if (
                          values.bedrockAuthMethod === 'accessKey' &&
                          (!values.bedrockAccessKeyId || !values.bedrockSecretAccessKey)
                        ) {
                          message.warning(t('settings.bedrock.fillRequiredFields'));
                          return;
                        }
                        if (values.bedrockAuthMethod === 'profile' && !values.bedrockProfile) {
                          message.warning(t('settings.bedrock.fillRequiredFields'));
                          return;
                        }
                        // Build bedrock_config and fetch models manually
                        const bedrock_config = {
                          auth_method: values.bedrockAuthMethod,
                          region: values.bedrockRegion,
                          ...(values.bedrockAuthMethod === 'accessKey'
                            ? {
                                access_key_id: values.bedrockAccessKeyId,
                                secret_access_key: values.bedrockSecretAccessKey,
                              }
                            : {
                                profile: values.bedrockProfile,
                              }),
                        };
                        try {
                          const res = await ipcBridge.mode.fetchModelList.invoke({
                            platform,
                            api_key: '',
                            bedrock_config,
                          });
                          const models =
                            res.models.map((v) => {
                              if (typeof v === 'string') {
                                return { label: v, value: v };
                              } else {
                                return { label: v.name, value: v.id };
                              }
                            }) || [];
                          // Update the model list state manually
                          void modelListState.mutate({ models }, false);
                        } catch (error: any) {
                          message.error(error.message || 'Failed to fetch models');
                        }
                        return;
                      }
                      // For Gemini, no api_key check needed
                      if (!isGemini && !api_key) {
                        message.warning(t('settings.pleaseEnterApiKey'));
                        return;
                      }
                      void modelListState.mutate();
                    }}
                    theme='outline'
                    size={16}
                    className='cursor-pointer text-t-secondary hover:text-t-primary'
                  />
                )
              }
              loading={!isDualRoute && !isFullUrl && modelListState.isLoading}
              options={isFullUrl || isDualRoute ? [] : modelListState.data?.models || []}
            />
          </Form.Item>

          {/* New API ??????? / New API Protocol Selection */}
          {isNewApi && (
            <Form.Item
              label={t('settings.modelProtocol')}
              extra={<span className='text-11px text-t-secondary'>{t('settings.modelProtocolTip')}</span>}
            >
              <Select value={modelProtocol} onChange={setModelProtocol} options={NEW_API_PROTOCOL_OPTIONS} />
            </Form.Item>
          )}
        </Form>
      </div>

      {/* API Key ???????? / API Key Editor Modal */}
      <ApiKeyEditorModal
        visible={api_keyEditorVisible}
        api_keys={api_key || ''}
        onClose={() => setApiKeyEditorVisible(false)}
        onSave={(keys) => {
          form.setFieldValue('api_key', keys);
          void modelListState.mutate();
        }}
        onTestKey={async (key) => {
          try {
            const res = await ipcBridge.mode.fetchModelList.invoke({
              base_url: actualBaseUrl,
              api_key: key,
              platform: selectedPlatform?.platform ?? 'custom',
            });
            return Array.isArray(res?.models) && res.models.length > 0;
          } catch {
            return false;
          }
        }}
      />
    </AionModal>
  );
});

export default AddPlatformModal;