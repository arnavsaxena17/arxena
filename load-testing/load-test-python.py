#!/usr/bin/env python3
"""
Python Load Test Script for /candidate-search/message/stream endpoint

Requirements:
    pip install requests aiohttp asyncio

Usage:
    python load-test-python.py --url http://localhost:3000 --token YOUR_TOKEN --concurrent 10 --duration 60

Options:
    --url: Base URL of the API (default: http://localhost:3000)
    --token: Bearer token for authentication (required)
    --job-id: Job ID - will automatically create a searchFilter (required if --search-filter-id not provided)
    --search-filter-id: Search filter ID to use (required if --job-id not provided)
    --concurrent: Number of concurrent requests (default: 5)
    --duration: Test duration in seconds (default: 30)
    --message: Message to send (default: "generate search parameters")
"""

import argparse
import asyncio
import aiohttp
import time
import json
from collections import defaultdict
from datetime import datetime

# Statistics tracking
stats = {
    'total_requests': 0,
    'successful_requests': 0,
    'failed_requests': 0,
    'timeout_requests': 0,
    'response_times': [],
    'events_received': 0,
    'bytes_received': 0,
    'errors': [],
    'active_connections': 0,
}

# Sample parsedJD
sample_parsed_jd = {
    "jobTitle": "Software Engineer",
    "company": "Tech Corp",
    "location": "San Francisco, CA",
    "industry": "Technology",
    "requiredSkills": ["JavaScript", "TypeScript", "React"],
    "preferredSkills": ["Node.js", "GraphQL"],
    "experienceLevel": "mid_level",
    "education": ["Bachelor's Degree"],
    "keywords": ["software", "engineer", "developer"],
    "responsibilities": ["Develop web applications", "Write clean code"],
    "qualifications": ["3+ years experience", "Strong problem-solving skills"],
    "benefits": ["Health insurance", "Remote work"],
    "employmentType": "full_time",
    "remoteWork": True,
    "salaryRange": None,
}


async def create_search_filter(job_id, token, base_url):
    """Create a SearchFilter for the given jobId"""
    mutation = """
      mutation CreateOneSearchFilter($input: SearchFilterCreateInput!) {
        createSearchFilter(data: $input) {
          id
          name
          jobId
          createdAt
        }
      }
    """
    
    variables = {
        "input": {
            "name": f"Load Test SearchFilter - {datetime.now().isoformat()}",
            "jobId": job_id,
            "searchFilterParameter": {},
            "chatHistory": [],
            "enrichmentConfigs": [],
            "columnFilters": [],
            # Note: sortColumns is not available in CreateInput, only in UpdateInput
        }
    }
    
    payload = {
        "query": mutation,
        "variables": variables,
    }
    
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {token}',
    }
    
    async with aiohttp.ClientSession() as session:
        async with session.post(
            f"{base_url}/graphql",
            headers=headers,
            json=payload,
            timeout=aiohttp.ClientTimeout(total=30)
        ) as response:
            if response.status != 200:
                error_text = await response.text()
                raise Exception(f"Failed to create SearchFilter: HTTP {response.status} - {error_text}")
            
            data = await response.json()
            
            if data.get('errors'):
                raise Exception(f"GraphQL errors: {json.dumps(data['errors'])}")
            
            if data.get('data', {}).get('createSearchFilter'):
                return data['data']['createSearchFilter']['id']
            else:
                raise Exception("Failed to create searchFilter - unexpected response")


async def make_sse_request(session, url, headers, payload, request_id):
    """Make a single SSE request and parse the stream"""
    stats['active_connections'] += 1
    start_time = time.time()
    events_received = 0
    bytes_received = 0
    received_done = False
    error = None

    try:
        async with session.post(
            url,
            headers=headers,
            json=payload,
            timeout=aiohttp.ClientTimeout(total=120)  # 2 minutes
        ) as response:
            if response.status != 200:
                error = f"HTTP {response.status}"
                stats['failed_requests'] += 1
                stats['errors'].append({
                    'request_id': request_id,
                    'error': error,
                    'timestamp': datetime.now().isoformat(),
                })
                return

            # Read SSE stream
            async for line in response.content:
                bytes_received += len(line)
                stats['bytes_received'] += len(line)
                
                line_str = line.decode('utf-8', errors='ignore')
                
                # Parse SSE format
                if line_str.startswith('event: '):
                    # Event type
                    pass
                elif line_str.startswith('data: '):
                    events_received += 1
                    stats['events_received'] += 1
                    data = line_str[6:].strip()
                    
                    try:
                        parsed = json.loads(data)
                        if parsed.get('error') or parsed.get('success') == False:
                            error = parsed.get('error', 'Unknown error')
                        if parsed.get('type') == 'done' or parsed.get('success') == True:
                            received_done = True
                    except json.JSONDecodeError:
                        # Not JSON, that's okay
                        pass

            response_time = (time.time() - start_time) * 1000  # Convert to ms

            if received_done or events_received > 0:
                stats['successful_requests'] += 1
                stats['response_times'].append(response_time)
            else:
                stats['failed_requests'] += 1
                error = error or 'Connection closed without completion'
                stats['errors'].append({
                    'request_id': request_id,
                    'error': error,
                    'timestamp': datetime.now().isoformat(),
                })

    except asyncio.TimeoutError:
        stats['timeout_requests'] += 1
        stats['failed_requests'] += 1
        stats['errors'].append({
            'request_id': request_id,
            'error': 'Request timeout',
            'timestamp': datetime.now().isoformat(),
        })
    except Exception as e:
        stats['failed_requests'] += 1
        stats['errors'].append({
            'request_id': request_id,
            'error': str(e),
            'timestamp': datetime.now().isoformat(),
        })
    finally:
        stats['total_requests'] += 1
        stats['active_connections'] -= 1


async def run_load_test(config):
    """Run the load test"""
    # Create searchFilter if jobId is provided
    search_filter_id = config.get('search_filter_id')
    if config.get('job_id') and not search_filter_id:
        print(f"Creating SearchFilter for jobId: {config['job_id']}")
        try:
            search_filter_id = await create_search_filter(
                config['job_id'],
                config['token'],
                config['url']
            )
            print(f"✅ SearchFilter created: {search_filter_id}\n")
            
            # Save to file for reference
            with open('test-search-filter-id.txt', 'w') as f:
                f.write(search_filter_id + '\n')
        except Exception as error:
            print(f"❌ Failed to create SearchFilter: {error}")
            print("Please provide --search-filter-id instead or check your job-id and token")
            return
    
    if not search_filter_id:
        print("❌ Error: Either --job-id or --search-filter-id is required")
        return

    print("=" * 60)
    print("Load Testing SSE Endpoint (Python)")
    print("=" * 60)
    print(f"URL: {config['url']}/candidate-search/message/stream")
    print(f"Concurrent Requests: {config['concurrent']}")
    print(f"Duration: {config['duration']} seconds")
    print(f"Search Filter ID: {search_filter_id}")
    if config.get('job_id'):
        print(f"Job ID: {config['job_id']}")
    print("=" * 60)
    print("Starting test...\n")

    url = f"{config['url']}/candidate-search/message/stream"
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f"Bearer {config['token']}",
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
    }
    payload = {
        'searchFilterId': search_filter_id,
        'message': config['message'],
        'parsedJD': sample_parsed_jd,
        'searchType': 'classic',
        'searchCategory': 'people',
        'sampleResults': [],
        'dataDistribution': {},
    }

    connector = aiohttp.TCPConnector(limit=config['concurrent'] * 2)
    timeout = aiohttp.ClientTimeout(total=120)
    
    async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
        start_time = time.time()
        end_time = start_time + config['duration']
        request_id = 0

        # Print stats periodically
        async def print_stats():
            while time.time() < end_time + 30:  # Continue for 30s after test ends
                await asyncio.sleep(5)
                elapsed = time.time() - start_time
                avg_rt = sum(stats['response_times']) / len(stats['response_times']) if stats['response_times'] else 0
                
                print(f"[{elapsed:.1f}s] "
                      f"Total: {stats['total_requests']} | "
                      f"Success: {stats['successful_requests']} | "
                      f"Failed: {stats['failed_requests']} | "
                      f"Active: {stats['active_connections']} | "
                      f"Avg RT: {avg_rt:.0f}ms | "
                      f"Events: {stats['events_received']} | "
                      f"Bytes: {stats['bytes_received'] / 1024 / 1024:.2f}MB")

        # Launch requests
        async def launch_requests():
            nonlocal request_id
            while time.time() < end_time:
                tasks = []
                for _ in range(config['concurrent']):
                    request_id += 1
                    tasks.append(make_sse_request(session, url, headers, payload, request_id))
                
                await asyncio.gather(*tasks, return_exceptions=True)
                await asyncio.sleep(1)  # Wait 1 second between batches

        # Run concurrently
        await asyncio.gather(
            launch_requests(),
            print_stats(),
        )

        # Wait for active connections
        while stats['active_connections'] > 0 and (time.time() - end_time) < 30:
            await asyncio.sleep(1)

    # Print final stats
    print_final_stats(start_time)


def print_final_stats(start_time):
    """Print final statistics"""
    total_time = time.time() - start_time
    response_times = stats['response_times']
    
    if response_times:
        avg_rt = sum(response_times) / len(response_times)
        min_rt = min(response_times)
        max_rt = max(response_times)
        sorted_rts = sorted(response_times)
        p95_rt = sorted_rts[int(len(sorted_rts) * 0.95)] if sorted_rts else 0
    else:
        avg_rt = min_rt = max_rt = p95_rt = 0

    success_rate = (stats['successful_requests'] / max(stats['total_requests'], 1)) * 100
    rps = stats['total_requests'] / total_time

    print("\n" + "=" * 60)
    print("FINAL STATISTICS")
    print("=" * 60)
    print(f"Test Duration: {total_time:.2f} seconds")
    print(f"Total Requests: {stats['total_requests']}")
    print(f"Successful Requests: {stats['successful_requests']}")
    print(f"Failed Requests: {stats['failed_requests']}")
    print(f"Timeout Requests: {stats['timeout_requests']}")
    print(f"Success Rate: {success_rate:.2f}%")
    print(f"Requests/Second: {rps:.2f}")
    print(f"\nResponse Times:")
    print(f"  Average: {avg_rt:.2f}ms")
    print(f"  Min: {min_rt:.2f}ms")
    print(f"  Max: {max_rt:.2f}ms")
    print(f"  P95: {p95_rt:.2f}ms")
    print(f"\nEvents & Data:")
    print(f"  Total Events Received: {stats['events_received']}")
    print(f"  Total Bytes Received: {stats['bytes_received'] / 1024 / 1024:.2f}MB")
    print(f"  Average Events per Request: {stats['events_received'] / max(stats['successful_requests'], 1):.2f}")
    
    if stats['errors']:
        print(f"\nErrors (showing first 10):")
        for i, error in enumerate(stats['errors'][:10], 1):
            print(f"  {i}. Request {error['request_id']}: {error['error']}")
        if len(stats['errors']) > 10:
            print(f"  ... and {len(stats['errors']) - 10} more errors")
    
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(description='Load test SSE endpoint')
    parser.add_argument('--url', default='http://localhost:3000', help='Base URL')
    parser.add_argument('--token', required=True, help='Bearer token')
    parser.add_argument('--job-id', help='Job ID - will automatically create a searchFilter')
    parser.add_argument('--search-filter-id', help='Search filter ID to use')
    parser.add_argument('--concurrent', type=int, default=5, help='Concurrent requests')
    parser.add_argument('--duration', type=int, default=30, help='Test duration (seconds)')
    parser.add_argument('--message', default='generate search parameters', help='Message to send')
    
    args = parser.parse_args()
    
    if not args.job_id and not args.search_filter_id:
        parser.error('Either --job-id or --search-filter-id is required')
    
    config = {
        'url': args.url,
        'token': args.token,
        'job_id': args.job_id,
        'search_filter_id': args.search_filter_id,
        'concurrent': args.concurrent,
        'duration': args.duration,
        'message': args.message,
    }
    
    asyncio.run(run_load_test(config))


if __name__ == '__main__':
    main()

