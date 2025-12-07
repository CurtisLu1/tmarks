// 测试注册API的简单脚本
const testRegister = async () => {
  try {
    const response = await fetch('https://b75ecc2c.tmarks-45l.pages.dev/api/v1/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        username: 'testuser123',
        password: 'testpassword123',
        email: 'test@example.com'
      })
    });

    console.log('Status:', response.status);
    console.log('Headers:', Object.fromEntries(response.headers.entries()));
    
    const text = await response.text();
    console.log('Response:', text);
    
    if (response.ok) {
      console.log('✅ 注册成功');
    } else {
      console.log('❌ 注册失败');
    }
  } catch (error) {
    console.error('请求错误:', error);
  }
};

testRegister();
