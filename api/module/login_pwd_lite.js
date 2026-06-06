// 酷狗概念版 (Lite) 账号密码登录
const { cryptoAesDecrypt, cryptoAesEncrypt, cryptoRSAEncrypt, signParamsKey } = require('../util');

module.exports = (params, useAxios) => {
  const dateTime = Date.now();
  const encrypt = cryptoAesEncrypt({ username: params?.username || '', code: params?.password || '' });

  const dataMap = {
    plat: 1,
    support_multi: 1,
    t1: 0,
    t2: 0,
    clienttime_ms: dateTime,
    username: params.username,
    key: signParamsKey(dateTime),
    // 概念版用简化加密：直接 RSA 加密 {clienttime_ms, code(密码), username}
    p2: cryptoRSAEncrypt({ clienttime_ms: dateTime, code: params.password, username: params.username }).toUpperCase(),
  };

  return new Promise((resolve, reject) => {
    useAxios({
      url: '/v6/login_by_pwd',
      method: 'POST',
      data: dataMap,
      encryptType: 'android',
      cookie: params?.cookie || {},
      headers: { 'x-router': 'login.user.kugou.com' },
    })
      .then((res) => {
        const { body } = res;
        if (body?.status && body?.status === 1) {
          if (body?.data?.secu_params) {
            const getToken = cryptoAesDecrypt(body.data.secu_params, encrypt.key);
            if (typeof getToken === 'object') {
              res.body.data = { ...body.data, ...getToken };
              Object.keys(getToken).forEach((key) => res.cookie.push(`${key}=${getToken[key]}`));
            } else {
              res.body.data['token'] = getToken;
            }
          }
          res.cookie.push(`token=${res.body.data['token']}`);
          res.cookie.push(`userid=${res.body.data?.userid || 0}`);
          res.cookie.push(`vip_type=${res.body.data?.vip_type || 0}`);
          res.cookie.push(`vip_token=${res.body.data?.vip_token || ''}`);
        }
        resolve(res);
      })
      .catch((e) => reject(e));
  });
};
