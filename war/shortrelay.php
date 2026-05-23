<?php
//
// This module acts as a relay to any URL shortener with a suitable API.
// Update the API call below if using a service other than TinyURL.
//
header('Content-Type: text/plain; charset=utf-8');

if (!isset($_GET['v']) || $_GET['v'] === '') {
	http_response_code(400);
	echo 'Missing URL to shorten.';
	exit;
}

$serveraddr = 'http' . (isset($_SERVER['HTTPS']) ? 's' : '') . '://' . "{$_SERVER['HTTP_HOST']}";
$s = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = str_replace('shortrelay.php', 'circuitjs.html', $s);
$target = $_GET['v'];
if (!preg_match('/^https?:\/\//', $target)) {
	$target = $serveraddr . $path . $target;
}

// TinyURL expects the target URL as a single encoded query parameter.
$apiUrl = 'https://tinyurl.com/api-create.php?url=' . rawurlencode($target);
$apiToken = getenv('TINYURL_API_TOKEN');
$brandedDomain = getenv('TINYURL_BRANDED_DOMAIN');

function request_with_curl($url, $method = 'GET', $headers = array(), $body = null) {
	$ch = curl_init();
	curl_setopt($ch, CURLOPT_URL, $url);
	curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
	curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true);
	curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 10);
	curl_setopt($ch, CURLOPT_TIMEOUT, 20);
	curl_setopt($ch, CURLOPT_USERAGENT, 'CircuitJS short URL relay');
	if ($method !== 'GET') {
		curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
	}
	if ($body !== null) {
		curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
	}
	if (!empty($headers)) {
		curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
	}
	$response = curl_exec($ch);
	$error = curl_error($ch);
	$status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
	curl_close($ch);
	return array($response, $error, $status);
}

if ($apiToken) {
	$payload = array('url' => $target);
	if ($brandedDomain) {
		$payload['domain'] = $brandedDomain;
	}
	$headers = array(
		'Authorization: Bearer ' . $apiToken,
		'Accept: application/json',
		'Content-Type: application/json'
	);
	$body = json_encode($payload);
	if (function_exists('curl_init')) {
		list($response, $error, $status) = request_with_curl('https://api.tinyurl.com/create', 'POST', $headers, $body);
		if ($response === false || $response === null || $response === '') {
			http_response_code(502);
			echo 'TinyURL API request failed: ' . ($error ? $error : 'empty response');
			exit;
		}
		if ($status < 200 || $status >= 300) {
			http_response_code(502);
			echo 'TinyURL API returned HTTP ' . $status . ': ' . $response;
			exit;
		}
		$data = json_decode($response, true);
		if (isset($data['data']['tiny_url']) && $data['data']['tiny_url'] !== '') {
			echo $data['data']['tiny_url'];
			exit;
		}
		http_response_code(502);
		echo 'TinyURL API returned an unexpected response: ' . $response;
		exit;
	}
	http_response_code(500);
	echo 'TinyURL API token is configured, but PHP cURL is not available on the server.';
	exit;
}

if (function_exists('curl_init')) {
	list($response, $error, $status) = request_with_curl($apiUrl);
	if ($response === false || $response === null || $response === '') {
		http_response_code(502);
		echo 'TinyURL request failed: ' . ($error ? $error : 'empty response');
		exit;
	}
	if ($status < 200 || $status >= 300) {
		http_response_code(502);
		echo 'TinyURL returned HTTP ' . $status . '.';
		exit;
	}
	echo $response;
	exit;
}

$response = @file_get_contents($apiUrl);
if ($response === false) {
	http_response_code(502);
	echo 'TinyURL request failed: no HTTP client is available on the server.';
	exit;
}

echo $response;
exit;
?>
