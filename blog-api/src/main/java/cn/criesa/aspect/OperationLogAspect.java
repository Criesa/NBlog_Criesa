package cn.criesa.aspect;

import cn.criesa.entity.OperationLog;
import cn.criesa.util.AopUtils;
import cn.criesa.util.JacksonUtils;
import cn.criesa.util.JwtUtils;
import cn.criesa.util.StringUtils;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.aspectj.lang.annotation.Pointcut;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.context.request.RequestContextHolder;
import org.springframework.web.context.request.ServletRequestAttributes;
import cn.criesa.annotation.OperationLogger;
import cn.criesa.service.OperationLogService;
import cn.criesa.util.IpAddressUtils;

import javax.servlet.http.HttpServletRequest;
import java.util.Map;

/**
 * @Description: AOP记录操作日志
 * @Author: Naccl
 * @Date: 2020-11-29
 */
@Component
@Aspect
public class OperationLogAspect {
	@Autowired
	OperationLogService operationLogService;

	ThreadLocal<Long> currentTime = new ThreadLocal<>();

	/**
	 * 配置切入点
	 */
	@Pointcut("@annotation(operationLogger)")
	public void logPointcut(OperationLogger operationLogger) {
	}

	/**
	 * 配置环绕通知
	 *
	 * @param joinPoint
	 * @return
	 * @throws Throwable
	 */
	@Around("logPointcut(operationLogger)")
	public Object logAround(ProceedingJoinPoint joinPoint, OperationLogger operationLogger) throws Throwable {
		currentTime.set(System.currentTimeMillis());
		Object result = joinPoint.proceed();
		int times = (int) (System.currentTimeMillis() - currentTime.get());
		currentTime.remove();
		OperationLog operationLog = handleLog(joinPoint, operationLogger, times);
		operationLogService.saveOperationLog(operationLog);
		return result;
	}

	/**
	 * 获取HttpServletRequest请求对象，并设置OperationLog对象属性
	 *
	 * @param operationLogger
	 * @param times
	 * @return
	 */
	private OperationLog handleLog(ProceedingJoinPoint joinPoint, OperationLogger operationLogger, int times) {
		ServletRequestAttributes attributes = (ServletRequestAttributes) RequestContextHolder.getRequestAttributes();
		HttpServletRequest request = attributes.getRequest();
		String username = JwtUtils.getTokenBody(request.getHeader("Authorization")).getSubject();
		String uri = request.getRequestURI();
		String method = request.getMethod();
		String description = operationLogger.value();
		String ip = IpAddressUtils.getIpAddress(request);
		String userAgent = request.getHeader("User-Agent");
		OperationLog log = new OperationLog(username, uri, method, description, ip, times, userAgent);
		Map<String, Object> requestParams = AopUtils.getRequestParams(joinPoint);
		log.setParam(StringUtils.substring(JacksonUtils.writeValueAsString(requestParams), 0, 2000));
		return log;
	}
}