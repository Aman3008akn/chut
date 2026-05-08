#include "thinking.h"
#include <sstream>
#include <iomanip>
#include <random>
#include <thread>
#include <algorithm>
#include <regex>
#include <filesystem>
#include <cstring>
#include <cmath>
#include <iomanip>
#include <numeric>
#include <fstream>
#include <atomic>

namespace fs = std::filesystem;

namespace nexus {
namespace thinking {

// ============================================================================
// Logger Implementation
// ============================================================================

Logger& Logger::getInstance() {
    static Logger instance;
    return instance;
}

Logger::Logger()
    : minLevel_(LogLevel::INFO)
    , consoleOutput_(true)
    , fileOutput_(false) {
}

Logger::~Logger() {
    if (outputFile_.is_open()) {
        outputFile_.close();
    }
}

void Logger::setLogLevel(LogLevel level) {
    std::lock_guard<std::mutex> lock(mutex_);
    minLevel_ = level;
}

LogLevel Logger::getLogLevel() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return minLevel_;
}

void Logger::log(LogLevel level, const std::string& message, const std::string& category) {
    if (level < minLevel_) {
        return;
    }
    
    LogEntry entry;
    entry.timestamp = std::chrono::system_clock::now();
    entry.level = level;
    entry.message = message;
    entry.category = category;
    entry.source = "thinking";
    entry.threadId = std::this_thread::get_id();
    entry.context = context_;
    
    {
        std::lock_guard<std::mutex> lock(mutex_);
        entries_.push_back(entry);
    }
    
    writeLog(entry);
}

void Logger::trace(const std::string& message, const std::string& category) {
    log(LogLevel::TRACE, message, category);
}

void Logger::debug(const std::string& message, const std::string& category) {
    log(LogLevel::DEBUG, message, category);
}

void Logger::info(const std::string& message, const std::string& category) {
    log(LogLevel::INFO, message, category);
}

void Logger::warning(const std::string& message, const std::string& category) {
    log(LogLevel::WARNING, message, category);
}

void Logger::error(const std::string& message, const std::string& category) {
    log(LogLevel::ERROR, message, category);
}

void Logger::critical(const std::string& message, const std::string& category) {
    log(LogLevel::CRITICAL, message, category);
}

void Logger::addContext(const std::string& key, const std::string& value) {
    std::lock_guard<std::mutex> lock(mutex_);
    context_[key] = value;
}

void Logger::removeContext(const std::string& key) {
    std::lock_guard<std::mutex> lock(mutex_);
    context_.erase(key);
}

void Logger::clearContext() {
    std::lock_guard<std::mutex> lock(mutex_);
    context_.clear();
}

void Logger::setOutputFile(const std::string& filename) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (outputFile_.is_open()) {
        outputFile_.close();
    }
    outputFile_.open(filename, std::ios::app);
    fileOutput_ = outputFile_.is_open();
}

void Logger::enableConsoleOutput(bool enable) {
    std::lock_guard<std::mutex> lock(mutex_);
    consoleOutput_ = enable;
}

void Logger::enableFileOutput(bool enable) {
    std::lock_guard<std::mutex> lock(mutex_);
    fileOutput_ = enable && outputFile_.is_open();
}

std::vector<LogEntry> Logger::getEntries(LogLevel minLevel) const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<LogEntry> result;
    for (const auto& entry : entries_) {
        if (entry.level >= minLevel) {
            result.push_back(entry);
        }
    }
    return result;
}

std::vector<LogEntry> Logger::getEntriesByCategory(const std::string& category) const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<LogEntry> result;
    for (const auto& entry : entries_) {
        if (entry.category == category) {
            result.push_back(entry);
        }
    }
    return result;
}

void Logger::clearEntries() {
    std::lock_guard<std::mutex> lock(mutex_);
    entries_.clear();
}

void Logger::writeLog(const LogEntry& entry) {
    std::string formatted = formatLogEntry(entry);
    
    if (consoleOutput_) {
        std::cout << formatted << std::endl;
    }
    
    if (fileOutput_ && outputFile_.is_open()) {
        outputFile_ << formatted << std::endl;
    }
}

std::string Logger::formatLogEntry(const LogEntry& entry) const {
    std::stringstream ss;
    auto time = std::chrono::system_clock::to_time_t(entry.timestamp);
    ss << "[" << std::put_time(std::localtime(&time), "%Y-%m-%d %H:%M:%S") << "] ";
    ss << "[" << levelToString(entry.level) << "] ";
    
    if (!entry.category.empty()) {
        ss << "[" << entry.category << "] ";
    }
    
    ss << entry.message;
    
    if (!entry.context.empty()) {
        ss << " | Context: {";
        bool first = true;
        for (const auto& [key, value] : entry.context) {
            if (!first) ss << ", ";
            ss << key << "=" << value;
            first = false;
        }
        ss << "}";
    }
    
    return ss.str();
}

std::string Logger::levelToString(LogLevel level) const {
    switch (level) {
        case LogLevel::TRACE: return "TRACE";
        case LogLevel::DEBUG: return "DEBUG";
        case LogLevel::INFO: return "INFO";
        case LogLevel::WARNING: return "WARN";
        case LogLevel::ERROR: return "ERROR";
        case LogLevel::CRITICAL: return "CRITICAL";
        case LogLevel::OFF: return "OFF";
        default: return "UNKNOWN";
    }
}

// ============================================================================
// Configuration Implementation
// ============================================================================

Configuration& Configuration::getInstance() {
    static Configuration instance;
    return instance;
}

void Configuration::loadFromFile(const std::string& filename) {
    std::lock_guard<std::mutex> lock(mutex_);
    std::ifstream file(filename);
    if (!file.is_open()) {
        throw ConfigurationException("Cannot open configuration file: " + filename);
    }
    
    std::string content((std::istreambuf_iterator<char>(file)),
                       std::istreambuf_iterator<char>());
    loadFromString(content);
}

void Configuration::saveToFile(const std::string& filename) const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::ofstream file(filename);
    if (!file.is_open()) {
        throw ConfigurationException("Cannot create configuration file: " + filename);
    }
    
    file << saveToString();
}

void Configuration::loadFromString(const std::string& json) {
    std::lock_guard<std::mutex> lock(mutex_);
    // Simple JSON parsing (in production, use a proper JSON library)
    std::regex pair_regex("\"([^\"]+)\"\\s*:\\s*\"([^\"]+)\"");
    std::sregex_iterator begin(json.begin(), json.end(), pair_regex);
    std::sregex_iterator end;
    
    for (std::sregex_iterator it = begin; it != end; ++it) {
        std::smatch match = *it;
        config_[match[1].str()] = match[2].str();
    }
}

std::string Configuration::saveToString() const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::stringstream ss;
    ss << "{";
    bool first = true;
    for (const auto& [key, value] : config_) {
        if (!first) ss << ",";
        ss << "\"" << key << "\":\"" << value << "\"";
        first = false;
    }
    ss << "}";
    return ss.str();
}

void Configuration::set(const std::string& key, const std::string& value) {
    std::lock_guard<std::mutex> lock(mutex_);
    config_[key] = value;
}

void Configuration::set(const std::string& key, int value) {
    set(key, std::to_string(value));
}

void Configuration::set(const std::string& key, double value) {
    set(key, std::to_string(value));
}

void Configuration::set(const std::string& key, bool value) {
    set(key, value ? "true" : "false");
}

std::string Configuration::getString(const std::string& key, const std::string& defaultValue) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = config_.find(key);
    return (it != config_.end()) ? it->second : defaultValue;
}

int Configuration::getInt(const std::string& key, int defaultValue) const {
    std::string value = getString(key);
    return value.empty() ? defaultValue : std::stoi(value);
}

double Configuration::getDouble(const std::string& key, double defaultValue) const {
    std::string value = getString(key);
    return value.empty() ? defaultValue : std::stod(value);
}

bool Configuration::getBool(const std::string& key, bool defaultValue) const {
    std::string value = getString(key);
    if (value.empty()) return defaultValue;
    return (value == "true" || value == "1" || value == "yes");
}

bool Configuration::has(const std::string& key) const {
    std::lock_guard<std::mutex> lock(mutex_);
    return config_.find(key) != config_.end();
}

void Configuration::remove(const std::string& key) {
    std::lock_guard<std::mutex> lock(mutex_);
    config_.erase(key);
}

void Configuration::clear() {
    std::lock_guard<std::mutex> lock(mutex_);
    config_.clear();
}

std::vector<std::string> Configuration::getKeys() const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<std::string> keys;
    keys.reserve(config_.size());
    for (const auto& [key, _] : config_) {
        keys.push_back(key);
    }
    return keys;
}

std::vector<std::string> Configuration::getKeysWithPrefix(const std::string& prefix) const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<std::string> keys;
    for (const auto& [key, _] : config_) {
        if (key.substr(0, prefix.length()) == prefix) {
            keys.push_back(key);
        }
    }
    return keys;
}

void Configuration::setDefaults(const std::map<std::string, std::string>& defaults) {
    std::lock_guard<std::mutex> lock(mutex_);
    for (const auto& [key, value] : defaults) {
        if (config_.find(key) == config_.end()) {
            config_[key] = value;
        }
    }
}

void Configuration::validate(const std::vector<std::string>& requiredKeys) const {
    std::lock_guard<std::mutex> lock(mutex_);
    for (const auto& key : requiredKeys) {
        if (config_.find(key) == config_.end()) {
            throw ConfigurationException("Required configuration key missing: " + key);
        }
    }
}

// ============================================================================
// ThreadPool Implementation
// ============================================================================

ThreadPool::ThreadPool(size_t numThreads)
    : stop_(false)
    , maxQueueSize_(0)
    , activeWorkers_(0) {
    for (size_t i = 0; i < numThreads; ++i) {
        workers_.emplace_back(&ThreadPool::workerThread, this);
    }
}

ThreadPool::~ThreadPool() {
    {
        std::unique_lock<std::mutex> lock(queueMutex_);
        stop_ = true;
    }
    condition_.notify_all();
    
    for (auto& worker : workers_) {
        if (worker.joinable()) {
            worker.join();
        }
    }
}

void ThreadPool::workerThread() {
    while (true) {
        std::function<void()> task;
        
        {
            std::unique_lock<std::mutex> lock(queueMutex_);
            condition_.wait(lock, [this]() {
                return stop_ || !tasks_.empty();
            });
            
            if (stop_ && tasks_.empty()) {
                return;
            }
            
            task = std::move(tasks_.front());
            tasks_.pop();
            activeWorkers_++;
        }
        
        task();
        
        {
            std::unique_lock<std::mutex> lock(queueMutex_);
            activeWorkers_--;
            finished_.notify_all();
        }
    }
}

void ThreadPool::resize(size_t numThreads) {
    std::unique_lock<std::mutex> lock(queueMutex_);
    
    if (numThreads < workers_.size()) {
        // Remove workers
        for (size_t i = numThreads; i < workers_.size(); ++i) {
            if (workers_[i].joinable()) {
                workers_[i].join();
            }
        }
        workers_.resize(numThreads);
    } else {
        // Add workers
        for (size_t i = workers_.size(); i < numThreads; ++i) {
            workers_.emplace_back(&ThreadPool::workerThread, this);
        }
    }
}

size_t ThreadPool::size() const {
    return workers_.size();
}

size_t ThreadPool::idleCount() const {
    std::unique_lock<std::mutex> lock(queueMutex_);
    return workers_.size() - activeWorkers_;
}

void ThreadPool::waitForAll() {
    std::unique_lock<std::mutex> lock(queueMutex_);
    finished_.wait(lock, [this]() {
        return tasks_.empty() && activeWorkers_ == 0;
    });
}

void ThreadPool::clear() {
    std::unique_lock<std::mutex> lock(queueMutex_);
    while (!tasks_.empty()) {
        tasks_.pop();
    }
}

void ThreadPool::setMaxQueueSize(size_t maxSize) {
    std::unique_lock<std::mutex> lock(queueMutex_);
    maxQueueSize_ = maxSize;
}

size_t ThreadPool::getMaxQueueSize() const {
    std::unique_lock<std::mutex> lock(queueMutex_);
    return maxQueueSize_;
}

size_t ThreadPool::getQueueSize() const {
    std::unique_lock<std::mutex> lock(queueMutex_);
    return tasks_.size();
}

// ============================================================================
// Cache Implementation
// ============================================================================

template<typename Key, typename Value>
Cache<Key, Value>::Cache(size_t maxSize, CacheEvictionPolicy policy, std::chrono::milliseconds defaultTtl)
    : maxSize_(maxSize)
    , evictionPolicy_(policy)
    , defaultTtl_(defaultTtl)
    , hitCount_(0)
    , missCount_(0) {
}

template<typename Key, typename Value>
void Cache<Key, Value>::put(const Key& key, const Value& value, std::chrono::milliseconds ttl) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    
    if (ttl.count() == 0) {
        ttl = defaultTtl_;
    }
    
    cache_[key] = CacheEntry<Key, Value>(value, ttl);
    evictIfNeeded();
}

template<typename Key, typename Value>
std::optional<Value> Cache<Key, Value>::get(const Key& key) {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    
    auto it = cache_.find(key);
    if (it == cache_.end()) {
        missCount_++;
        return std::nullopt;
    }
    
    if (it->second.isExpired()) {
        missCount_++;
        return std::nullopt;
    }
    
    const_cast<CacheEntry<Key, Value>&>(it->second).access();
    hitCount_++;
    return it->second.value;
}

template<typename Key, typename Value>
bool Cache<Key, Value>::has(const Key& key) const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    
    auto it = cache_.find(key);
    if (it == cache_.end()) {
        return false;
    }
    
    return !it->second.isExpired();
}

template<typename Key, typename Value>
void Cache<Key, Value>::remove(const Key& key) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    cache_.erase(key);
}

template<typename Key, typename Value>
void Cache<Key, Value>::clear() {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    cache_.clear();
}

template<typename Key, typename Value>
void Cache<Key, Value>::setMaxSize(size_t maxSize) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    maxSize_ = maxSize;
    evictIfNeeded();
}

template<typename Key, typename Value>
void Cache<Key, Value>::setEvictionPolicy(CacheEvictionPolicy policy) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    evictionPolicy_ = policy;
}

template<typename Key, typename Value>
void Cache<Key, Value>::setDefaultTtl(std::chrono::milliseconds ttl) {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    defaultTtl_ = ttl;
}

template<typename Key, typename Value>
size_t Cache<Key, Value>::size() const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    return cache_.size();
}

template<typename Key, typename Value>
size_t Cache<Key, Value>::getMaxSize() const {
    return maxSize_;
}

template<typename Key, typename Value>
double Cache<Key, Value>::hitRate() const {
    size_t total = hitCount_ + missCount_;
    return total > 0 ? static_cast<double>(hitCount_) / total : 0.0;
}

template<typename Key, typename Value>
size_t Cache<Key, Value>::hitCount() const {
    return hitCount_;
}

template<typename Key, typename Value>
size_t Cache<Key, Value>::missCount() const {
    return missCount_;
}

template<typename Key, typename Value>
void Cache<Key, Value>::cleanupExpired() {
    std::unique_lock<std::shared_mutex> lock(mutex_);
    
    auto it = cache_.begin();
    while (it != cache_.end()) {
        if (it->second.isExpired()) {
            it = cache_.erase(it);
        } else {
            ++it;
        }
    }
}

template<typename Key, typename Value>
std::vector<Key> Cache<Key, Value>::getKeys() const {
    std::shared_lock<std::shared_mutex> lock(mutex_);
    std::vector<Key> keys;
    keys.reserve(cache_.size());
    for (const auto& [key, _] : cache_) {
        keys.push_back(key);
    }
    return keys;
}

template<typename Key, typename Value>
void Cache<Key, Value>::evictIfNeeded() {
    while (cache_.size() > maxSize_) {
        Key keyToEvict = selectKeyToEvict();
        cache_.erase(keyToEvict);
    }
}

template<typename Key, typename Value>
Key Cache<Key, Value>::selectKeyToEvict() const {
    if (cache_.empty()) {
        throw std::runtime_error("Cannot evict from empty cache");
    }
    
    switch (evictionPolicy_) {
        case CacheEvictionPolicy::LRU: {
            Key oldest = cache_.begin()->first;
            auto oldestTime = cache_.begin()->second.lastAccessed;
            
            for (const auto& [key, entry] : cache_) {
                if (entry.lastAccessed < oldestTime) {
                    oldest = key;
                    oldestTime = entry.lastAccessed;
                }
            }
            return oldest;
        }
        
        case CacheEvictionPolicy::LFU: {
            Key leastFrequent = cache_.begin()->first;
            auto minAccessCount = cache_.begin()->second.accessCount;
            
            for (const auto& [key, entry] : cache_) {
                if (entry.accessCount < minAccessCount) {
                    leastFrequent = key;
                    minAccessCount = entry.accessCount;
                }
            }
            return leastFrequent;
        }
        
        case CacheEvictionPolicy::FIFO:
            return cache_.begin()->first;
        
        case CacheEvictionPolicy::LIFO: {
            Key last = cache_.begin()->first;
            for (const auto& [key, _] : cache_) {
                last = key;
            }
            return last;
        }
        
        case CacheEvictionPolicy::RANDOM: {
            auto it = cache_.begin();
            std::advance(it, rand() % cache_.size());
            return it->first;
        }
        
        default:
            return cache_.begin()->first;
    }
}

// Explicit template instantiations
template class Cache<std::string, std::string>;
template class Cache<std::string, ThinkingSession>;
template class Cache<std::string, ThinkingStep>;

// ============================================================================
// EventBus Implementation
// ============================================================================

EventBus& EventBus::getInstance() {
    static EventBus instance;
    return instance;
}

EventBus::SubscriptionId EventBus::subscribe(const std::string& eventType, EventCallback callback, EventPriority minPriority) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    Subscription sub;
    sub.id = nextSubscriptionId_++;
    sub.callback = callback;
    sub.minPriority = minPriority;
    sub.eventType = eventType;
    
    subscriptions_[eventType].push_back(sub);
    
    return sub.id;
}

void EventBus::unsubscribe(SubscriptionId subscriptionId) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    for (auto& [eventType, subs] : subscriptions_) {
        auto it = std::remove_if(subs.begin(), subs.end(),
            [subscriptionId](const Subscription& sub) {
                return sub.id == subscriptionId;
            });
        subs.erase(it, subs.end());
    }
}

void EventBus::unsubscribeAll(const std::string& eventType) {
    std::lock_guard<std::mutex> lock(mutex_);
    subscriptions_.erase(eventType);
}

void EventBus::publish(const Event& event) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto it = subscriptions_.find(event.type);
    if (it == subscriptions_.end()) {
        return;
    }
    
    for (const auto& sub : it->second) {
        if (event.priority >= sub.minPriority) {
            sub.callback(event.type, event.data);
        }
    }
}

void EventBus::publishAsync(const Event& event) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (maxQueueSize_ > 0 && eventQueue_.size() >= maxQueueSize_) {
        return; // Queue full, drop event
    }
    
    eventQueue_.push(event);
}

void EventBus::setMaxQueueSize(size_t maxSize) {
    std::lock_guard<std::mutex> lock(mutex_);
    maxQueueSize_ = maxSize;
}

void EventBus::processQueue() {
    while (true) {
        Event event;
        {
            std::lock_guard<std::mutex> lock(mutex_);
            if (eventQueue_.empty()) {
                break;
            }
            event = eventQueue_.front();
            eventQueue_.pop();
        }
        publish(event);
    }
}

void EventBus::clearQueue() {
    std::lock_guard<std::mutex> lock(mutex_);
    while (!eventQueue_.empty()) {
        eventQueue_.pop();
    }
}

size_t EventBus::getSubscriberCount(const std::string& eventType) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = subscriptions_.find(eventType);
    return (it != subscriptions_.end()) ? it->second.size() : 0;
}

size_t EventBus::getQueueSize() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return eventQueue_.size();
}

// ============================================================================
// Statistics Implementation
// ============================================================================

Statistics& Statistics::getInstance() {
    static Statistics instance;
    return instance;
}

void Statistics::incrementCounter(const std::string& key, double delta) {
    std::lock_guard<std::mutex> lock(mutex_);
    counters_[key] += delta;
}

void Statistics::setGauge(const std::string& key, double value) {
    std::lock_guard<std::mutex> lock(mutex_);
    gauges_[key] = value;
}

void Statistics::recordTiming(const std::string& key, double durationMs) {
    std::lock_guard<std::mutex> lock(mutex_);
    timings_[key].push_back(durationMs);
}

void Statistics::recordHistogram(const std::string& key, double value) {
    std::lock_guard<std::mutex> lock(mutex_);
    histograms_[key].push_back(value);
}

double Statistics::getCounter(const std::string& key) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = counters_.find(key);
    return (it != counters_.end()) ? it->second : 0.0;
}

double Statistics::getGauge(const std::string& key) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = gauges_.find(key);
    return (it != gauges_.end()) ? it->second : 0.0;
}

double Statistics::getTimingAverage(const std::string& key) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = timings_.find(key);
    if (it == timings_.end() || it->second.empty()) {
        return 0.0;
    }
    
    double sum = std::accumulate(it->second.begin(), it->second.end(), 0.0);
    return sum / it->second.size();
}

double Statistics::getTimingPercentile(const std::string& key, double percentile) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = timings_.find(key);
    if (it == timings_.end() || it->second.empty()) {
        return 0.0;
    }
    
    std::vector<double> sorted = it->second;
    std::sort(sorted.begin(), sorted.end());
    
    size_t index = static_cast<size_t>(percentile * sorted.size());
    if (index >= sorted.size()) {
        index = sorted.size() - 1;
    }
    
    return sorted[index];
}

double Statistics::getHistogramCount(const std::string& key) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = histograms_.find(key);
    return (it != histograms_.end()) ? it->second.size() : 0.0;
}

double Statistics::getHistogramAverage(const std::string& key) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = histograms_.find(key);
    if (it == histograms_.end() || it->second.empty()) {
        return 0.0;
    }
    
    double sum = std::accumulate(it->second.begin(), it->second.end(), 0.0);
    return sum / it->second.size();
}

void Statistics::resetCounter(const std::string& key) {
    std::lock_guard<std::mutex> lock(mutex_);
    counters_.erase(key);
}

void Statistics::resetGauge(const std::string& key) {
    std::lock_guard<std::mutex> lock(mutex_);
    gauges_.erase(key);
}

void Statistics::resetTiming(const std::string& key) {
    std::lock_guard<std::mutex> lock(mutex_);
    timings_.erase(key);
}

void Statistics::resetHistogram(const std::string& key) {
    std::lock_guard<std::mutex> lock(mutex_);
    histograms_.erase(key);
}

void Statistics::resetAll() {
    std::lock_guard<std::mutex> lock(mutex_);
    counters_.clear();
    gauges_.clear();
    timings_.clear();
    histograms_.clear();
}

std::vector<std::string> Statistics::getCounterKeys() const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<std::string> keys;
    keys.reserve(counters_.size());
    for (const auto& [key, _] : counters_) {
        keys.push_back(key);
    }
    return keys;
}

std::vector<std::string> Statistics::getGaugeKeys() const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<std::string> keys;
    keys.reserve(gauges_.size());
    for (const auto& [key, _] : gauges_) {
        keys.push_back(key);
    }
    return keys;
}

std::vector<std::string> Statistics::getTimingKeys() const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<std::string> keys;
    keys.reserve(timings_.size());
    for (const auto& [key, _] : timings_) {
        keys.push_back(key);
    }
    return keys;
}

std::vector<std::string> Statistics::getHistogramKeys() const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<std::string> keys;
    keys.reserve(histograms_.size());
    for (const auto& [key, _] : histograms_) {
        keys.push_back(key);
    }
    return keys;
}

std::string Statistics::generateReport() const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    std::stringstream ss;
    ss << "=== Statistics Report ===" << std::endl;
    ss << std::endl;
    
    ss << "Counters:" << std::endl;
    for (const auto& [key, value] : counters_) {
        ss << "  " << key << ": " << value << std::endl;
    }
    ss << std::endl;
    
    ss << "Gauges:" << std::endl;
    for (const auto& [key, value] : gauges_) {
        ss << "  " << key << ": " << value << std::endl;
    }
    ss << std::endl;
    
    ss << "Timings:" << std::endl;
    for (const auto& [key, values] : timings_) {
        double sum = std::accumulate(values.begin(), values.end(), 0.0);
        double avg = sum / values.size();
        ss << "  " << key << ": " << values.size() << " samples, avg: " << avg << "ms" << std::endl;
    }
    ss << std::endl;
    
    ss << "Histograms:" << std::endl;
    for (const auto& [key, values] : histograms_) {
        double sum = std::accumulate(values.begin(), values.end(), 0.0);
        double avg = sum / values.size();
        ss << "  " << key << ": " << values.size() << " samples, avg: " << avg << std::endl;
    }
    
    return ss.str();
}

void Statistics::exportToJson(const std::string& filename) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    std::ofstream file(filename);
    if (!file.is_open()) {
        throw SerializationException("Cannot open file for export: " + filename);
    }
    
    file << "{";
    
    // Counters
    file << "\"counters\":{";
    bool first = true;
    for (const auto& [key, value] : counters_) {
        if (!first) file << ",";
        file << "\"" << key << "\":" << value;
        first = false;
    }
    file << "},";
    
    // Gauges
    file << "\"gauges\":{";
    first = true;
    for (const auto& [key, value] : gauges_) {
        if (!first) file << ",";
        file << "\"" << key << "\":" << value;
        first = false;
    }
    file << "},";
    
    // Timings
    file << "\"timings\":{";
    first = true;
    for (const auto& [key, values] : timings_) {
        if (!first) file << ",";
        file << "\"" << key << "\":[";
        bool firstVal = true;
        for (double val : values) {
            if (!firstVal) file << ",";
            file << val;
            firstVal = false;
        }
        file << "]";
        first = false;
    }
    file << "},";
    
    // Histograms
    file << "\"histograms\":{";
    first = true;
    for (const auto& [key, values] : histograms_) {
        if (!first) file << ",";
        file << "\"" << key << "\":[";
        bool firstVal = true;
        for (double val : values) {
            if (!firstVal) file << ",";
            file << val;
            firstVal = false;
        }
        file << "]";
        first = false;
    }
    file << "}";
    
    file << "}";
}

// ============================================================================
// Validator Implementation
// ============================================================================

const std::regex Validator::ID_PATTERN("^[a-zA-Z0-9_-]{3,64}$");
const std::regex Validator::EMAIL_PATTERN("^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$");
const std::regex Validator::URL_PATTERN("^https?://[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}(/.*)?$");

bool Validator::isValidId(const std::string& id) {
    return std::regex_match(id, ID_PATTERN);
}

bool Validator::isValidEmail(const std::string& email) {
    return std::regex_match(email, EMAIL_PATTERN);
}

bool Validator::isValidUrl(const std::string& url) {
    return std::regex_match(url, URL_PATTERN);
}

bool Validator::isValidJson(const std::string& json) {
    // Simple JSON validation - check for balanced braces and brackets
    int braces = 0;
    int brackets = 0;
    bool inString = false;
    bool escape = false;
    
    for (char c : json) {
        if (escape) {
            escape = false;
            continue;
        }
        
        if (c == '\\') {
            escape = true;
            continue;
        }
        
        if (c == '"') {
            inString = !inString;
            continue;
        }
        
        if (inString) continue;
        
        if (c == '{') braces++;
        else if (c == '}') braces--;
        else if (c == '[') brackets++;
        else if (c == ']') brackets--;
        
        if (braces < 0 || brackets < 0) {
            return false;
        }
    }
    
    return braces == 0 && brackets == 0 && !inString;
}

void Validator::validateId(const std::string& id) {
    if (!isValidId(id)) {
        throw ValidationException("Invalid ID: " + id);
    }
}

void Validator::validateEmail(const std::string& email) {
    if (!isValidEmail(email)) {
        throw ValidationException("Invalid email: " + email);
    }
}

void Validator::validateUrl(const std::string& url) {
    if (!isValidUrl(url)) {
        throw ValidationException("Invalid URL: " + url);
    }
}

void Validator::validateJson(const std::string& json) {
    if (!isValidJson(json)) {
        throw ValidationException("Invalid JSON");
    }
}

std::string Validator::sanitizeString(const std::string& input) {
    std::string result;
    result.reserve(input.size());
    
    for (char c : input) {
        if (c >= 32 && c <= 126) {
            result += c;
        }
    }
    
    return result;
}

std::string Validator::sanitizeHtml(const std::string& input) {
    std::string result;
    result.reserve(input.size() * 1.5);
    
    for (char c : input) {
        switch (c) {
            case '<': result += "&lt;"; break;
            case '>': result += "&gt;"; break;
            case '&': result += "&amp;"; break;
            case '"': result += "&quot;"; break;
            case '\'': result += "&#x27;"; break;
            default: result += c; break;
        }
    }
    
    return result;
}

std::string Validator::sanitizeSql(const std::string& input) {
    std::string result;
    result.reserve(input.size() * 2);
    
    for (char c : input) {
        switch (c) {
            case '\'': result += "''"; break;
            case '\\': result += "\\\\"; break;
            default: result += c; break;
        }
    }
    
    return result;
}

bool Validator::isNumeric(const std::string& str) {
    if (str.empty()) return false;
    
    size_t start = 0;
    if (str[0] == '-') start = 1;
    
    bool hasDecimal = false;
    for (size_t i = start; i < str.size(); ++i) {
        if (str[i] == '.') {
            if (hasDecimal) return false;
            hasDecimal = true;
        } else if (!std::isdigit(str[i])) {
            return false;
        }
    }
    
    return true;
}

bool Validator::isAlpha(const std::string& str) {
    if (str.empty()) return false;
    return std::all_of(str.begin(), str.end(), [](char c) {
        return std::isalpha(c);
    });
}

bool Validator::isAlphanumeric(const std::string& str) {
    if (str.empty()) return false;
    return std::all_of(str.begin(), str.end(), [](char c) {
        return std::isalnum(c);
    });
}

std::string Validator::truncate(const std::string& str, size_t maxLength) {
    if (str.size() <= maxLength) {
        return str;
    }
    return str.substr(0, maxLength);
}

std::string Validator::normalizeWhitespace(const std::string& str) {
    std::string result;
    bool inWhitespace = false;
    
    for (char c : str) {
        if (std::isspace(c)) {
            if (!inWhitespace) {
                result += ' ';
                inWhitespace = true;
            }
        } else {
            result += c;
            inWhitespace = false;
        }
    }
    
    return utils::trim(result);
}

// ============================================================================
// ThinkingStepManager Implementation
// ============================================================================

ThinkingStepManager::ThinkingStepManager(const std::string& id, const std::string& label, int order)
    : step_(id, label, order) {
}

void ThinkingStepManager::setActive() {
    std::lock_guard<std::mutex> lock(mutex_);
    step_.status = StepStatus::ACTIVE;
    step_.startTime = std::chrono::system_clock::now();
}

void ThinkingStepManager::setDone() {
    std::lock_guard<std::mutex> lock(mutex_);
    step_.status = StepStatus::DONE;
    step_.endTime = std::chrono::system_clock::now();
    step_.progress = 1.0;
}

void ThinkingStepManager::setFailed(const std::string& error) {
    std::lock_guard<std::mutex> lock(mutex_);
    step_.status = StepStatus::FAILED;
    step_.errorMessage = error;
    step_.endTime = std::chrono::system_clock::now();
}

void ThinkingStepManager::setCancelled() {
    std::lock_guard<std::mutex> lock(mutex_);
    step_.status = StepStatus::CANCELLED;
    step_.endTime = std::chrono::system_clock::now();
}

void ThinkingStepManager::setSkipped() {
    std::lock_guard<std::mutex> lock(mutex_);
    step_.status = StepStatus::SKIPPED;
    step_.endTime = std::chrono::system_clock::now();
}

void ThinkingStepManager::setProgress(double progress) {
    std::lock_guard<std::mutex> lock(mutex_);
    step_.progress = std::clamp(progress, 0.0, 1.0);
}

void ThinkingStepManager::setMetadata(const std::string& key, const std::string& value) {
    std::lock_guard<std::mutex> lock(mutex_);
    step_.metadata[key] = value;
}

std::string ThinkingStepManager::getMetadata(const std::string& key, const std::string& defaultValue) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = step_.metadata.find(key);
    return (it != step_.metadata.end()) ? it->second : defaultValue;
}

void ThinkingStepManager::removeMetadata(const std::string& key) {
    std::lock_guard<std::mutex> lock(mutex_);
    step_.metadata.erase(key);
}

std::vector<std::string> ThinkingStepManager::getMetadataKeys() const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<std::string> keys;
    keys.reserve(step_.metadata.size());
    for (const auto& [key, _] : step_.metadata) {
        keys.push_back(key);
    }
    return keys;
}

void ThinkingStepManager::setParentId(const std::string& parentId) {
    std::lock_guard<std::mutex> lock(mutex_);
    step_.parentId = parentId;
}

void ThinkingStepManager::addChildId(const std::string& childId) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (std::find(step_.childIds.begin(), step_.childIds.end(), childId) == step_.childIds.end()) {
        step_.childIds.push_back(childId);
    }
}

void ThinkingStepManager::removeChildId(const std::string& childId) {
    std::lock_guard<std::mutex> lock(mutex_);
    step_.childIds.erase(std::remove(step_.childIds.begin(), step_.childIds.end(), childId), step_.childIds.end());
}

void ThinkingStepManager::setDeadline(const std::chrono::system_clock::time_point& deadline) {
    std::lock_guard<std::mutex> lock(mutex_);
    step_.deadline = deadline;
}

void ThinkingStepManager::addTag(const std::string& tag) {
    std::lock_guard<std::mutex> lock(mutex_);
    if (std::find(step_.tags.begin(), step_.tags.end(), tag) == step_.tags.end()) {
        step_.tags.push_back(tag);
    }
}

void ThinkingStepManager::removeTag(const std::string& tag) {
    std::lock_guard<std::mutex> lock(mutex_);
    step_.tags.erase(std::remove(step_.tags.begin(), step_.tags.end(), tag), step_.tags.end());
}

bool ThinkingStepManager::hasTag(const std::string& tag) const {
    std::lock_guard<std::mutex> lock(mutex_);
    return std::find(step_.tags.begin(), step_.tags.end(), tag) != step_.tags.end();
}

std::string ThinkingStepManager::toJson() const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    std::stringstream ss;
    ss << "{";
    ss << utils::buildJsonPair("id", step_.id) << ",";
    ss << utils::buildJsonPair("label", step_.label) << ",";
    ss << utils::buildJsonPair("status", utils::statusToString(step_.status)) << ",";
    ss << utils::buildJsonPair("description", step_.description) << ",";
    
    auto start_time = std::chrono::system_clock::to_time_t(step_.startTime);
    ss << "\"startTime\":\"" << std::put_time(std::localtime(&start_time), "%Y-%m-%dT%H:%M:%S") << "\",";
    
    if (step_.status == StepStatus::DONE || step_.status == StepStatus::FAILED || 
        step_.status == StepStatus::CANCELLED || step_.status == StepStatus::SKIPPED) {
        auto end_time = std::chrono::system_clock::to_time_t(step_.endTime);
        ss << "\"endTime\":\"" << std::put_time(std::localtime(&end_time), "%Y-%m-%dT%H:%M:%S") << "\",";
    }
    
    ss << "\"durationMs\":" << step_.getDurationMs() << ",";
    ss << "\"order\":" << step_.order << ",";
    ss << "\"progress\":" << step_.progress << ",";
    ss << "\"retryCount\":" << step_.retryCount << ",";
    ss << "\"maxRetries\":" << step_.maxRetries << ",";
    ss << utils::buildJsonPair("category", step_.category) << ",";
    ss << "\"priority\":" << step_.priority << ",";
    ss << "\"isCritical\":" << (step_.isCritical ? "true" : "false") << ",";
    ss << utils::buildJsonPair("assignedTo", step_.assignedTo) << ",";
    ss << utils::buildJsonPair("inputData", step_.inputData) << ",";
    ss << utils::buildJsonPair("outputData", step_.outputData) << ",";
    
    if (!step_.errorMessage.empty()) {
        ss << utils::buildJsonPair("errorMessage", step_.errorMessage) << ",";
    }
    
    if (!step_.parentId.empty()) {
        ss << utils::buildJsonPair("parentId", step_.parentId) << ",";
    }
    
    // Tags array
    ss << "\"tags\":[";
    for (size_t i = 0; i < step_.tags.size(); ++i) {
        if (i > 0) ss << ",";
        ss << "\"" << utils::escapeJsonString(step_.tags[i]) << "\"";
    }
    ss << "],";
    
    // Child IDs array
    ss << "\"childIds\":[";
    for (size_t i = 0; i < step_.childIds.size(); ++i) {
        if (i > 0) ss << ",";
        ss << "\"" << utils::escapeJsonString(step_.childIds[i]) << "\"";
    }
    ss << "],";
    
    // Metadata object
    ss << "\"metadata\":{";
    bool first = true;
    for (const auto& [key, value] : step_.metadata) {
        if (!first) ss << ",";
        ss << utils::buildJsonPair(key, value);
        first = false;
    }
    ss << "}";
    
    ss << "}";
    return ss.str();
}

ThinkingStep ThinkingStepManager::fromJson(const std::string& json) {
    ThinkingStep step;
    
    // Simple JSON parsing (in production, use a proper JSON library)
    std::regex id_regex("\"id\"\\s*:\\s*\"([^\"]+)\"");
    std::regex label_regex("\"label\"\\s*:\\s*\"([^\"]+)\"");
    std::regex status_regex("\"status\"\\s*:\\s*\"([^\"]+)\"");
    std::regex order_regex("\"order\"\\s*:\\s*(\\d+)");
    std::regex error_regex("\"errorMessage\"\\s*:\\s*\"([^\"]+)\"");
    std::regex progress_regex("\"progress\"\\s*:\\s*([0-9.]+)");
    std::regex retry_regex("\"retryCount\"\\s*:\\s*(\\d+)");
    std::regex max_retry_regex("\"maxRetries\"\\s*:\\s*(\\d+)");
    std::regex category_regex("\"category\"\\s*:\\s*\"([^\"]+)\"");
    std::regex priority_regex("\"priority\"\\s*:\\s*(\\d+)");
    std::regex critical_regex("\"isCritical\"\\s*:\\s*(true|false)");
    std::regex assigned_regex("\"assignedTo\"\\s*:\\s*\"([^\"]+)\"");
    std::regex parent_regex("\"parentId\"\\s*:\\s*\"([^\"]+)\"");
    
    std::smatch match;
    if (std::regex_search(json, match, id_regex)) {
        step.id = match[1].str();
    }
    if (std::regex_search(json, match, label_regex)) {
        step.label = match[1].str();
    }
    if (std::regex_search(json, match, status_regex)) {
        step.status = utils::stringToStatus(match[1].str());
    }
    if (std::regex_search(json, match, order_regex)) {
        step.order = std::stoi(match[1].str());
    }
    if (std::regex_search(json, match, error_regex)) {
        step.errorMessage = match[1].str();
    }
    if (std::regex_search(json, match, progress_regex)) {
        step.progress = std::stod(match[1].str());
    }
    if (std::regex_search(json, match, retry_regex)) {
        step.retryCount = std::stoi(match[1].str());
    }
    if (std::regex_search(json, match, max_retry_regex)) {
        step.maxRetries = std::stoi(match[1].str());
    }
    if (std::regex_search(json, match, category_regex)) {
        step.category = match[1].str();
    }
    if (std::regex_search(json, match, priority_regex)) {
        step.priority = std::stoi(match[1].str());
    }
    if (std::regex_search(json, match, critical_regex)) {
        step.isCritical = (match[1].str() == "true");
    }
    if (std::regex_search(json, match, assigned_regex)) {
        step.assignedTo = match[1].str();
    }
    if (std::regex_search(json, match, parent_regex)) {
        step.parentId = match[1].str();
    }
    
    step.startTime = std::chrono::system_clock::now();
    
    return step;
}

std::string ThinkingStepManager::toBinary() const {
    BinarySerializer serializer;
    
    std::lock_guard<std::mutex> lock(mutex_);
    
    serializer.writeString(step_.id);
    serializer.writeString(step_.label);
    serializer.writeString(step_.description);
    serializer.writeInt8(static_cast<int8_t>(step_.status));
    serializer.writeInt32(step_.order);
    serializer.writeDouble(step_.progress);
    serializer.writeInt32(step_.retryCount);
    serializer.writeInt32(step_.maxRetries);
    serializer.writeString(step_.category);
    serializer.writeInt32(step_.priority);
    serializer.writeBool(step_.isCritical);
    serializer.writeString(step_.assignedTo);
    serializer.writeString(step_.errorMessage);
    serializer.writeString(step_.parentId);
    serializer.writeString(step_.inputData);
    serializer.writeString(step_.outputData);
    
    // Write metadata
    serializer.writeInt32(static_cast<int32_t>(step_.metadata.size()));
    for (const auto& [key, value] : step_.metadata) {
        serializer.writeString(key);
        serializer.writeString(value);
    }
    
    // Write tags
    serializer.writeInt32(static_cast<int32_t>(step_.tags.size()));
    for (const auto& tag : step_.tags) {
        serializer.writeString(tag);
    }
    
    // Write child IDs
    serializer.writeInt32(static_cast<int32_t>(step_.childIds.size()));
    for (const auto& childId : step_.childIds) {
        serializer.writeString(childId);
    }
    
    auto data = serializer.getData();
    return std::string(data.begin(), data.end());
}

ThinkingStep ThinkingStepManager::fromBinary(const std::string& binary) {
    BinarySerializer serializer;
    serializer.setData(std::vector<uint8_t>(binary.begin(), binary.end()));
    
    ThinkingStep step;
    
    step.id = serializer.readString();
    step.label = serializer.readString();
    step.description = serializer.readString();
    step.status = static_cast<StepStatus>(serializer.readInt8());
    step.order = serializer.readInt32();
    step.progress = serializer.readDouble();
    step.retryCount = serializer.readInt32();
    step.maxRetries = serializer.readInt32();
    step.category = serializer.readString();
    step.priority = serializer.readInt32();
    step.isCritical = serializer.readBool();
    step.assignedTo = serializer.readString();
    step.errorMessage = serializer.readString();
    step.parentId = serializer.readString();
    step.inputData = serializer.readString();
    step.outputData = serializer.readString();
    
    // Read metadata
    int32_t metadataCount = serializer.readInt32();
    for (int32_t i = 0; i < metadataCount; ++i) {
        std::string key = serializer.readString();
        std::string value = serializer.readString();
        step.metadata[key] = value;
    }
    
    // Read tags
    int32_t tagCount = serializer.readInt32();
    for (int32_t i = 0; i < tagCount; ++i) {
        step.tags.push_back(serializer.readString());
    }
    
    // Read child IDs
    int32_t childCount = serializer.readInt32();
    for (int32_t i = 0; i < childCount; ++i) {
        step.childIds.push_back(serializer.readString());
    }
    
    step.startTime = std::chrono::system_clock::now();
    
    return step;
}

// ============================================================================
// ThinkingManager Implementation
// ============================================================================

ThinkingManager::ThinkingManager() 
    : stepCallback_(nullptr), sessionCallback_(nullptr), progressCallback_(nullptr),
      errorCallback_(nullptr), completionCallback_(nullptr), metricCallback_(nullptr) {
}

std::string ThinkingManager::createSession(const std::string& messageId) {
    return createSession(messageId, "");
}

std::string ThinkingManager::createSession(const std::string& messageId, const std::string& userId) {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto session = std::make_unique<ThinkingSession>();
    session->id = utils::generateId();
    session->messageId = messageId;
    session->userId = userId;
    session->state = ThinkingState::IDLE;
    
    sessions_[session->id] = std::move(session);
    
    notifySessionChange(*sessions_[session->id]);
    
    return session->id;
}

bool ThinkingManager::hasSession(const std::string& sessionId) const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    return sessions_.find(sessionId) != sessions_.end();
}

ThinkingSession* ThinkingManager::getSession(const std::string& sessionId) {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    auto it = sessions_.find(sessionId);
    return (it != sessions_.end()) ? it->second.get() : nullptr;
}

const ThinkingSession* ThinkingManager::getSession(const std::string& sessionId) const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    auto it = sessions_.find(sessionId);
    return (it != sessions_.end()) ? it->second.get() : nullptr;
}

void ThinkingManager::removeSession(const std::string& sessionId) {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    sessions_.erase(sessionId);
}

std::vector<std::string> ThinkingManager::getAllSessionIds() const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    std::vector<std::string> ids;
    ids.reserve(sessions_.size());
    
    for (const auto& pair : sessions_) {
        ids.push_back(pair.first);
    }
    
    return ids;
}

std::vector<std::string> ThinkingManager::getSessionIdsByUserId(const std::string& userId) const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    std::vector<std::string> ids;
    
    for (const auto& [id, session] : sessions_) {
        if (session->userId == userId) {
            ids.push_back(id);
        }
    }
    
    return ids;
}

std::vector<std::string> ThinkingManager::getSessionIdsByTag(const std::string& tag) const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    std::vector<std::string> ids;
    
    for (const auto& [id, session] : sessions_) {
        if (session->hasTag(tag)) {
            ids.push_back(id);
        }
    }
    
    return ids;
}

size_t ThinkingManager::getSessionCount() const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    return sessions_.size();
}

std::string ThinkingManager::addStep(const std::string& sessionId, const std::string& label, int order) {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    if (it == sessions_.end()) {
        throw SessionNotFoundException(sessionId);
    }
    
    ThinkingStep step(utils::generateId(), label, order);
    it->second->steps.push_back(step);
    
    notifyStepChange(step);
    notifyProgress(it->second->getProgress());
    
    return step.id;
}

std::string ThinkingManager::addStep(const std::string& sessionId, const ThinkingStep& step) {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    if (it == sessions_.end()) {
        throw SessionNotFoundException(sessionId);
    }
    
    it->second->steps.push_back(step);
    
    notifyStepChange(step);
    notifyProgress(it->second->getProgress());
    
    return step.id;
}

bool ThinkingManager::updateStepStatus(const std::string& sessionId, const std::string& stepId, StepStatus status) {
    return updateStepStatus(sessionId, stepId, status, "");
}

bool ThinkingManager::updateStepStatus(const std::string& sessionId, const std::string& stepId, StepStatus status, const std::string& error) {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    if (it == sessions_.end()) {
        return false;
    }
    
    for (auto& step : it->second->steps) {
        if (step.id == stepId) {
            step.status = status;
            if (!error.empty()) {
                step.errorMessage = error;
            }
            if (status == StepStatus::DONE || status == StepStatus::FAILED || 
                status == StepStatus::CANCELLED || status == StepStatus::SKIPPED) {
                step.endTime = std::chrono::system_clock::now();
            }
            
            notifyStepChange(step);
            notifyProgress(it->second->getProgress());
            
            return true;
        }
    }
    
    return false;
}

bool ThinkingManager::updateStepProgress(const std::string& sessionId, const std::string& stepId, double progress) {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    if (it == sessions_.end()) {
        return false;
    }
    
    for (auto& step : it->second->steps) {
        if (step.id == stepId) {
            step.progress = std::clamp(progress, 0.0, 1.0);
            notifyProgress(it->second->getProgress());
            return true;
        }
    }
    
    return false;
}

bool ThinkingManager::removeStep(const std::string& sessionId, const std::string& stepId) {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    if (it == sessions_.end()) {
        return false;
    }
    
    auto stepIt = std::find_if(it->second->steps.begin(), it->second->steps.end(),
        [&stepId](const ThinkingStep& step) { return step.id == stepId; });
    
    if (stepIt != it->second->steps.end()) {
        it->second->steps.erase(stepIt);
        notifyProgress(it->second->getProgress());
        return true;
    }
    
    return false;
}

std::vector<std::string> ThinkingManager::getStepIds(const std::string& sessionId) const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    if (it == sessions_.end()) {
        return {};
    }
    
    std::vector<std::string> ids;
    ids.reserve(it->second->steps.size());
    
    for (const auto& step : it->second->steps) {
        ids.push_back(step.id);
    }
    
    return ids;
}

void ThinkingManager::setSessionState(const std::string& sessionId, ThinkingState state) {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    if (it != sessions_.end()) {
        it->second->state = state;
        if (state == ThinkingState::COMPLETED || state == ThinkingState::ERROR || 
            state == ThinkingState::CANCELLED || state == ThinkingState::TIMEOUT) {
            it->second->endTime = std::chrono::system_clock::now();
        }
        
        notifySessionChange(*it->second);
    }
}

ThinkingState ThinkingManager::getSessionState(const std::string& sessionId) const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    return (it != sessions_.end()) ? it->second->state : ThinkingState::ERROR;
}

void ThinkingManager::pauseSession(const std::string& sessionId) {
    setSessionState(sessionId, ThinkingState::PAUSED);
}

void ThinkingManager::resumeSession(const std::string& sessionId) {
    auto session = getSession(sessionId);
    if (session && session->state == ThinkingState::PAUSED) {
        setSessionState(sessionId, ThinkingState::THINKING);
    }
}

void ThinkingManager::cancelSession(const std::string& sessionId) {
    setSessionState(sessionId, ThinkingState::CANCELLED);
}

void ThinkingManager::retrySession(const std::string& sessionId) {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    if (it != sessions_.end() && it->second->canRetry()) {
        it->second->incrementRetry();
        notifySessionChange(*it->second);
    }
}

double ThinkingManager::getSessionProgress(const std::string& sessionId) const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    return (it != sessions_.end()) ? it->second->getProgress() : 0.0;
}

int ThinkingManager::getCompletedSteps(const std::string& sessionId) const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    return (it != sessions_.end()) ? it->second->getCompletedSteps() : 0;
}

int ThinkingManager::getFailedSteps(const std::string& sessionId) const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    return (it != sessions_.end()) ? it->second->getFailedSteps() : 0;
}

int ThinkingManager::getActiveSteps(const std::string& sessionId) const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    return (it != sessions_.end()) ? it->second->getActiveSteps() : 0;
}

int ThinkingManager::getTotalSteps(const std::string& sessionId) const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    return (it != sessions_.end()) ? it->second->getTotalSteps() : 0;
}

double ThinkingManager::getSuccessRate(const std::string& sessionId) const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    return (it != sessions_.end()) ? it->second->getSuccessRate() : 0.0;
}

void ThinkingManager::setSessionMetadata(const std::string& sessionId, const std::string& key, const std::string& value) {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    if (it != sessions_.end()) {
        it->second->metadata[key] = value;
    }
}

std::string ThinkingManager::getSessionMetadata(const std::string& sessionId, const std::string& key, const std::string& defaultValue) const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    if (it != sessions_.end()) {
        auto metaIt = it->second->metadata.find(key);
        return (metaIt != it->second->metadata.end()) ? metaIt->second : defaultValue;
    }
    return defaultValue;
}

void ThinkingManager::addSessionTag(const std::string& sessionId, const std::string& tag) {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    if (it != sessions_.end()) {
        it->second->addTag(tag);
    }
}

void ThinkingManager::removeSessionTag(const std::string& sessionId, const std::string& tag) {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    if (it != sessions_.end()) {
        it->second->removeTag(tag);
    }
}

bool ThinkingManager::sessionHasTag(const std::string& sessionId, const std::string& tag) const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    return (it != sessions_.end()) ? it->second->hasTag(tag) : false;
}

void ThinkingManager::setSessionModel(const std::string& sessionId, const std::string& model) {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    if (it != sessions_.end()) {
        it->second->model = model;
    }
}

void ThinkingManager::setSessionTemperature(const std::string& sessionId, double temperature) {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    if (it != sessions_.end()) {
        it->second->temperature = temperature;
    }
}

void ThinkingManager::setSessionMaxTokens(const std::string& sessionId, int maxTokens) {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    if (it != sessions_.end()) {
        it->second->maxTokens = maxTokens;
    }
}

void ThinkingManager::setSessionDeadline(const std::string& sessionId, const std::chrono::system_clock::time_point& deadline) {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    if (it != sessions_.end()) {
        it->second->deadline = deadline;
    }
}

void ThinkingManager::setSessionPriority(const std::string& sessionId, int priority) {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    if (it != sessions_.end()) {
        it->second->priority = priority;
    }
}

void ThinkingManager::setSessionPersistent(const std::string& sessionId, bool persistent) {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    if (it != sessions_.end()) {
        it->second->isPersistent = persistent;
    }
}

void ThinkingManager::setStepCallback(StepCallback callback) {
    std::lock_guard<std::mutex> lock(callbackMutex_);
    stepCallback_ = callback;
}

void ThinkingManager::setSessionCallback(SessionCallback callback) {
    std::lock_guard<std::mutex> lock(callbackMutex_);
    sessionCallback_ = callback;
}

void ThinkingManager::setProgressCallback(ProgressCallback callback) {
    std::lock_guard<std::mutex> lock(callbackMutex_);
    progressCallback_ = callback;
}

void ThinkingManager::setErrorCallback(ErrorCallback callback) {
    std::lock_guard<std::mutex> lock(callbackMutex_);
    errorCallback_ = callback;
}

void ThinkingManager::setCompletionCallback(CompletionCallback callback) {
    std::lock_guard<std::mutex> lock(callbackMutex_);
    completionCallback_ = callback;
}

void ThinkingManager::setMetricCallback(MetricCallback callback) {
    std::lock_guard<std::mutex> lock(callbackMutex_);
    metricCallback_ = callback;
}

void ThinkingManager::cleanupOldSessions(int maxAgeMs) {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto now = std::chrono::system_clock::now();
    
    for (auto it = sessions_.begin(); it != sessions_.end(); ) {
        auto age = std::chrono::duration<double, std::milli>(now - it->second->startTime).count();
        if (age > maxAgeMs) {
            it = sessions_.erase(it);
        } else {
            ++it;
        }
    }
}

void ThinkingManager::clearAllSessions() {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    sessions_.clear();
}

void ThinkingManager::clearCompletedSessions() {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    for (auto it = sessions_.begin(); it != sessions_.end(); ) {
        if (it->second->state == ThinkingState::COMPLETED) {
            it = sessions_.erase(it);
        } else {
            ++it;
        }
    }
}

void ThinkingManager::clearFailedSessions() {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    for (auto it = sessions_.begin(); it != sessions_.end(); ) {
        if (it->second->state == ThinkingState::ERROR) {
            it = sessions_.erase(it);
        } else {
            ++it;
        }
    }
}

std::string ThinkingManager::sessionToJson(const std::string& sessionId) const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    if (it == sessions_.end()) {
        return "{}";
    }
    
    const auto& session = it->second;
    
    std::stringstream ss;
    ss << "{";
    ss << utils::buildJsonPair("id", session->id) << ",";
    ss << utils::buildJsonPair("messageId", session->messageId) << ",";
    ss << utils::buildJsonPair("userId", session->userId) << ",";
    ss << utils::buildJsonPair("state", utils::stateToString(session->state)) << ",";
    ss << utils::buildJsonPair("context", session->context) << ",";
    ss << utils::buildJsonPair("model", session->model) << ",";
    ss << utils::buildJsonPair("version", session->version) << ",";
    ss << "\"temperature\":" << session->temperature << ",";
    ss << "\"maxTokens\":" << session->maxTokens << ",";
    ss << "\"priority\":" << session->priority << ",";
    ss << "\"isPersistent\":" << (session->isPersistent ? "true" : "false") << ",";
    ss << "\"retryCount\":" << session->retryCount << ",";
    ss << "\"maxRetries\":" << session->maxRetries << ",";
    
    auto start_time = std::chrono::system_clock::to_time_t(session->startTime);
    ss << "\"startTime\":\"" << std::put_time(std::localtime(&start_time), "%Y-%m-%dT%H:%M:%S") << "\",";
    
    if (session->state == ThinkingState::COMPLETED || session->state == ThinkingState::ERROR || 
        session->state == ThinkingState::CANCELLED || session->state == ThinkingState::TIMEOUT) {
        auto end_time = std::chrono::system_clock::to_time_t(session->endTime);
        ss << "\"endTime\":\"" << std::put_time(std::localtime(&end_time), "%Y-%m-%dT%H:%M:%S") << "\",";
    }
    
    ss << "\"totalDurationMs\":" << session->getTotalDurationMs() << ",";
    ss << "\"progress\":" << session->getProgress() << ",";
    ss << "\"completedSteps\":" << session->getCompletedSteps() << ",";
    ss << "\"failedSteps\":" << session->getFailedSteps() << ",";
    ss << "\"activeSteps\":" << session->getActiveSteps() << ",";
    ss << "\"totalSteps\":" << session->getTotalSteps() << ",";
    ss << "\"successRate\":" << session->getSuccessRate() << ",";
    
    if (!session->errorMessage.empty()) {
        ss << utils::buildJsonPair("errorMessage", session->errorMessage) << ",";
    }
    
    if (!session->parentSessionId.empty()) {
        ss << utils::buildJsonPair("parentSessionId", session->parentSessionId) << ",";
    }
    
    if (!session->correlationId.empty()) {
        ss << utils::buildJsonPair("correlationId", session->correlationId) << ",";
    }
    
    if (!session->requestId.empty()) {
        ss << utils::buildJsonPair("requestId", session->requestId) << ",";
    }
    
    if (!session->traceId.empty()) {
        ss << utils::buildJsonPair("traceId", session->traceId) << ",";
    }
    
    // Tags array
    ss << "\"tags\":[";
    for (size_t i = 0; i < session->tags.size(); ++i) {
        if (i > 0) ss << ",";
        ss << "\"" << utils::escapeJsonString(session->tags[i]) << "\"";
    }
    ss << "],";
    
    // Steps array
    ss << "\"steps\":[";
    for (size_t i = 0; i < session->steps.size(); ++i) {
        if (i > 0) ss << ",";
        
        const auto& step = session->steps[i];
        ss << "{";
        ss << utils::buildJsonPair("id", step.id) << ",";
        ss << utils::buildJsonPair("label", step.label) << ",";
        ss << utils::buildJsonPair("status", utils::statusToString(step.status)) << ",";
        ss << "\"durationMs\":" << step.getDurationMs() << ",";
        ss << "\"order\":" << step.order << ",";
        ss << "\"progress\":" << step.progress << ",";
        ss << "\"priority\":" << step.priority << ",";
        ss << "\"isCritical\":" << (step.isCritical ? "true" : "false");
        
        if (!step.errorMessage.empty()) {
            ss << "," << utils::buildJsonPair("errorMessage", step.errorMessage);
        }
        
        ss << "}";
    }
    ss << "],";
    
    // Metadata object
    ss << "\"metadata\":{";
    bool first = true;
    for (const auto& [key, value] : session->metadata) {
        if (!first) ss << ",";
        ss << utils::buildJsonPair(key, value);
        first = false;
    }
    ss << "},";
    
    // Metrics object
    ss << "\"metrics\":{";
    first = true;
    for (const auto& [key, value] : session->metrics) {
        if (!first) ss << ",";
        ss << "\"" << key << "\":" << value;
        first = false;
    }
    ss << "}";
    
    ss << "}";
    return ss.str();
}

std::string ThinkingManager::allSessionsToJson() const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    std::stringstream ss;
    ss << "{";
    ss << "\"sessions\":[";
    
    size_t index = 0;
    for (const auto& pair : sessions_) {
        if (index > 0) ss << ",";
        ss << sessionToJson(pair.first);
        ++index;
    }
    
    ss << "],";
    ss << "\"totalSessions\":" << sessions_.size();
    ss << "}";
    
    return ss.str();
}

std::string ThinkingManager::sessionToBinary(const std::string& sessionId) const {
    BinarySerializer serializer;
    
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    auto it = sessions_.find(sessionId);
    if (it == sessions_.end()) {
        return "";
    }
    
    const auto& session = it->second;
    
    serializer.writeString(session->id);
    serializer.writeString(session->messageId);
    serializer.writeString(session->userId);
    serializer.writeString(session->context);
    serializer.writeInt8(static_cast<int8_t>(session->state));
    serializer.writeString(session->model);
    serializer.writeString(session->version);
    serializer.writeDouble(session->temperature);
    serializer.writeInt32(session->maxTokens);
    serializer.writeInt32(session->priority);
    serializer.writeBool(session->isPersistent);
    serializer.writeString(session->persistenceKey);
    serializer.writeInt32(session->retryCount);
    serializer.writeInt32(session->maxRetries);
    serializer.writeString(session->correlationId);
    serializer.writeString(session->requestId);
    serializer.writeString(session->traceId);
    
    // Write tags
    serializer.writeInt32(static_cast<int32_t>(session->tags.size()));
    for (const auto& tag : session->tags) {
        serializer.writeString(tag);
    }
    
    // Write metadata
    serializer.writeInt32(static_cast<int32_t>(session->metadata.size()));
    for (const auto& [key, value] : session->metadata) {
        serializer.writeString(key);
        serializer.writeString(value);
    }
    
    // Write metrics
    serializer.writeInt32(static_cast<int32_t>(session->metrics.size()));
    for (const auto& [key, value] : session->metrics) {
        serializer.writeString(key);
        serializer.writeDouble(value);
    }
    
    // Write steps
    serializer.writeInt32(static_cast<int32_t>(session->steps.size()));
    for (const auto& step : session->steps) {
        serializer.writeString(step.id);
        serializer.writeString(step.label);
        serializer.writeString(step.description);
        serializer.writeInt8(static_cast<int8_t>(step.status));
        serializer.writeInt32(step.order);
        serializer.writeDouble(step.progress);
        serializer.writeInt32(step.retryCount);
        serializer.writeInt32(step.maxRetries);
        serializer.writeString(step.category);
        serializer.writeInt32(step.priority);
        serializer.writeBool(step.isCritical);
        serializer.writeString(step.assignedTo);
        serializer.writeString(step.errorMessage);
        serializer.writeString(step.parentId);
        serializer.writeString(step.inputData);
        serializer.writeString(step.outputData);
    }
    
    auto data = serializer.getData();
    return std::string(data.begin(), data.end());
}

bool ThinkingManager::sessionFromBinary(const std::string& binary, ThinkingSession& session) const {
    BinarySerializer serializer;
    serializer.setData(std::vector<uint8_t>(binary.begin(), binary.end()));
    
    try {
        session.id = serializer.readString();
        session.messageId = serializer.readString();
        session.userId = serializer.readString();
        session.context = serializer.readString();
        session.state = static_cast<ThinkingState>(serializer.readInt8());
        session.model = serializer.readString();
        session.version = serializer.readString();
        session.temperature = serializer.readDouble();
        session.maxTokens = serializer.readInt32();
        session.priority = serializer.readInt32();
        session.isPersistent = serializer.readBool();
        session.persistenceKey = serializer.readString();
        session.retryCount = serializer.readInt32();
        session.maxRetries = serializer.readInt32();
        session.correlationId = serializer.readString();
        session.requestId = serializer.readString();
        session.traceId = serializer.readString();
        
        // Read tags
        int32_t tagCount = serializer.readInt32();
        for (int32_t i = 0; i < tagCount; ++i) {
            session.tags.push_back(serializer.readString());
        }
        
        // Read metadata
        int32_t metadataCount = serializer.readInt32();
        for (int32_t i = 0; i < metadataCount; ++i) {
            std::string key = serializer.readString();
            std::string value = serializer.readString();
            session.metadata[key] = value;
        }
        
        // Read metrics
        int32_t metricsCount = serializer.readInt32();
        for (int32_t i = 0; i < metricsCount; ++i) {
            std::string key = serializer.readString();
            double value = serializer.readDouble();
            session.metrics[key] = value;
        }
        
        // Read steps
        int32_t stepCount = serializer.readInt32();
        for (int32_t i = 0; i < stepCount; ++i) {
            ThinkingStep step;
            step.id = serializer.readString();
            step.label = serializer.readString();
            step.description = serializer.readString();
            step.status = static_cast<StepStatus>(serializer.readInt8());
            step.order = serializer.readInt32();
            step.progress = serializer.readDouble();
            step.retryCount = serializer.readInt32();
            step.maxRetries = serializer.readInt32();
            step.category = serializer.readString();
            step.priority = serializer.readInt32();
            step.isCritical = serializer.readBool();
            step.assignedTo = serializer.readString();
            step.errorMessage = serializer.readString();
            step.parentId = serializer.readString();
            step.inputData = serializer.readString();
            step.outputData = serializer.readString();
            session.steps.push_back(step);
        }
        
        session.startTime = std::chrono::system_clock::now();
        
        return true;
    } catch (...) {
        return false;
    }
}

std::map<std::string, double> ThinkingManager::getSessionStatistics(const std::string& sessionId) const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    std::map<std::string, double> stats;
    
    auto it = sessions_.find(sessionId);
    if (it == sessions_.end()) {
        return stats;
    }
    
    const auto& session = it->second;
    
    stats["totalSteps"] = session->getTotalSteps();
    stats["completedSteps"] = session->getCompletedSteps();
    stats["failedSteps"] = session->getFailedSteps();
    stats["activeSteps"] = session->getActiveSteps();
    stats["progress"] = session->getProgress();
    stats["successRate"] = session->getSuccessRate();
    stats["totalDurationMs"] = session->getTotalDurationMs();
    stats["retryCount"] = session->retryCount;
    
    return stats;
}

std::map<std::string, double> ThinkingManager::getGlobalStatistics() const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    std::map<std::string, double> stats;
    
    stats["totalSessions"] = sessions_.size();
    
    int completed = 0;
    int failed = 0;
    int active = 0;
    int idle = 0;
    
    for (const auto& [id, session] : sessions_) {
        switch (session->state) {
            case ThinkingState::COMPLETED: completed++; break;
            case ThinkingState::ERROR: failed++; break;
            case ThinkingState::THINKING: active++; break;
            case ThinkingState::IDLE: idle++; break;
            default: break;
        }
    }
    
    stats["completedSessions"] = completed;
    stats["failedSessions"] = failed;
    stats["activeSessions"] = active;
    stats["idleSessions"] = idle;
    
    return stats;
}

std::vector<ThinkingSession*> ThinkingManager::searchSessions(const std::string& query) const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    std::vector<ThinkingSession*> results;
    std::string lowerQuery = utils::toLower(query);
    
    for (auto& [id, session] : sessions_) {
        std::string idLower = utils::toLower(session->id);
        std::string messageLower = utils::toLower(session->messageId);
        std::string userLower = utils::toLower(session->userId);
        
        if (idLower.find(lowerQuery) != std::string::npos ||
            messageLower.find(lowerQuery) != std::string::npos ||
            userLower.find(lowerQuery) != std::string::npos) {
            results.push_back(session.get());
        }
    }
    
    return results;
}

std::vector<ThinkingSession*> ThinkingManager::filterSessions(std::function<bool(const ThinkingSession&)> predicate) const {
    std::lock_guard<std::mutex> lock(sessionsMutex_);
    
    std::vector<ThinkingSession*> results;
    
    for (auto& [id, session] : sessions_) {
        if (predicate(*session)) {
            results.push_back(session.get());
        }
    }
    
    return results;
}

std::vector<ThinkingSession*> ThinkingManager::getSessionsByState(ThinkingState state) const {
    return filterSessions([state](const ThinkingSession& session) {
        return session.state == state;
    });
}

std::vector<ThinkingSession*> ThinkingManager::getOverdueSessions() const {
    return filterSessions([](const ThinkingSession& session) {
        return session.isOverdue();
    });
}

std::vector<ThinkingSession*> ThinkingManager::getSessionsByPriority(int minPriority) const {
    return filterSessions([minPriority](const ThinkingSession& session) {
        return session.priority >= minPriority;
    });
}

void ThinkingManager::notifyStepChange(const ThinkingStep& step) {
    std::lock_guard<std::mutex> lock(callbackMutex_);
    if (stepCallback_) {
        stepCallback_(step);
    }
}

void ThinkingManager::notifySessionChange(const ThinkingSession& session) {
    std::lock_guard<std::mutex> lock(callbackMutex_);
    if (sessionCallback_) {
        sessionCallback_(session);
    }
}

void ThinkingManager::notifyProgress(double progress) {
    std::lock_guard<std::mutex> lock(callbackMutex_);
    if (progressCallback_) {
        progressCallback_(progress);
    }
}

void ThinkingManager::notifyError(const std::string& sessionId, const std::string& error) {
    std::lock_guard<std::mutex> lock(callbackMutex_);
    if (errorCallback_) {
        errorCallback_(sessionId, error);
    }
}

void ThinkingManager::notifyCompletion(bool success, const std::string& sessionId) {
    std::lock_guard<std::mutex> lock(callbackMutex_);
    if (completionCallback_) {
        completionCallback_(success, sessionId);
    }
}

void ThinkingManager::notifyMetric(const std::string& key, double value) {
    std::lock_guard<std::mutex> lock(callbackMutex_);
    if (metricCallback_) {
        metricCallback_(key, value);
    }
}

// ============================================================================
// ThinkingService Implementation
// ============================================================================

ThinkingService::ThinkingService()
    : running_(false)
    , maxConcurrentSessions_(DEFAULT_MAX_CONCURRENT_SESSIONS)
    , processingTimeoutMs_(DEFAULT_PROCESSING_TIMEOUT_MS)
    , maxRetries_(3)
    , retryDelayMs_(1000)
    , processedCount_(0)
    , failedCount_(0)
    , cancelledCount_(0)
    , timeoutCount_(0)
    , manager_(new ThinkingManager())
    , threadPool_(nullptr) {
}

ThinkingService::~ThinkingService() {
    stop();
    delete manager_;
}

bool ThinkingService::start() {
    if (running_) {
        return false;
    }
    
    running_ = true;
    workerThread_ = std::make_unique<std::thread>(&ThinkingService::workerLoop, this);
    threadPool_ = std::make_unique<ThreadPool>(maxConcurrentSessions_);
    
    return true;
}

void ThinkingService::stop() {
    if (!running_) {
        return;
    }
    
    running_ = false;
    queueCondition_.notify_all();
    
    if (workerThread_ && workerThread_->joinable()) {
        workerThread_->join();
    }
    
    if (threadPool_) {
        threadPool_.reset();
    }
}

void ThinkingService::restart() {
    stop();
    start();
}

void ThinkingService::processSession(const std::string& sessionId) {
    processSessionInternal(sessionId);
}

void ThinkingService::processStep(const std::string& sessionId, const std::string& stepId) {
    if (!processStepInternal(sessionId, stepId)) {
        handleFailure(sessionId, "Step not found or processing failed");
    }
}

void ThinkingService::processBatch(const std::vector<std::string>& sessionIds) {
    for (const auto& sessionId : sessionIds) {
        addToQueue(sessionId);
    }
}

void ThinkingService::processSessionAsync(const std::string& sessionId, std::function<void(bool)> callback) {
    std::thread([this, sessionId, callback]() {
        bool success = false;
        try {
            success = simulateThinkingProcess(sessionId);
        } catch (...) {
            success = false;
        }
        if (callback) {
            callback(success);
        }
    }).detach();
}

void ThinkingService::processStepAsync(const std::string& sessionId, const std::string& stepId, std::function<void(bool)> callback) {
    std::thread([this, sessionId, stepId, callback]() {
        bool success = processStepInternal(sessionId, stepId);
        if (callback) {
            callback(success);
        }
    }).detach();
}

void ThinkingService::addToQueue(const std::string& sessionId) {
    std::lock_guard<std::mutex> lock(queueMutex_);
    processingQueue_.push_back(sessionId);
    queueCondition_.notify_one();
}

void ThinkingService::addToQueueFront(const std::string& sessionId) {
    std::lock_guard<std::mutex> lock(queueMutex_);
    processingQueue_.push_front(sessionId);
    queueCondition_.notify_one();
}

void ThinkingService::removeFromQueue(const std::string& sessionId) {
    std::lock_guard<std::mutex> lock(queueMutex_);
    processingQueue_.erase(std::remove(processingQueue_.begin(), processingQueue_.end(), sessionId), 
                            processingQueue_.end());
}

int ThinkingService::getQueueSize() const {
    std::lock_guard<std::mutex> lock(queueMutex_);
    return processingQueue_.size();
}

std::vector<std::string> ThinkingService::getQueueContents() const {
    std::lock_guard<std::mutex> lock(queueMutex_);
    return std::vector<std::string>(processingQueue_.begin(), processingQueue_.end());
}

void ThinkingService::clearQueue() {
    std::lock_guard<std::mutex> lock(queueMutex_);
    processingQueue_.clear();
}

void ThinkingService::prioritizeQueue(std::function<bool(const std::string&)> predicate) {
    std::lock_guard<std::mutex> lock(queueMutex_);
    
    std::stable_partition(processingQueue_.begin(), processingQueue_.end(), predicate);
}

void ThinkingService::setMaxConcurrentSessions(int max) {
    maxConcurrentSessions_ = max;
    if (threadPool_) {
        threadPool_->resize(max);
    }
}

void ThinkingService::setProcessingTimeoutMs(int timeout) {
    processingTimeoutMs_ = timeout;
}

void ThinkingService::setRetryPolicy(int maxRetries, int retryDelayMs) {
    maxRetries_ = maxRetries;
    retryDelayMs_ = retryDelayMs;
}

void ThinkingService::setThreadPoolSize(size_t size) {
    if (threadPool_) {
        threadPool_->resize(size);
    }
}

double ThinkingService::getAverageProcessingTimeMs() const {
    std::lock_guard<std::mutex> lock(statsMutex_);
    
    if (processingTimes_.empty()) {
        return 0.0;
    }
    
    double sum = std::accumulate(processingTimes_.begin(), processingTimes_.end(), 0.0);
    return sum / processingTimes_.size();
}

double ThinkingService::getMedianProcessingTimeMs() const {
    std::lock_guard<std::mutex> lock(statsMutex_);
    
    if (processingTimes_.empty()) {
        return 0.0;
    }
    
    std::vector<double> sorted = processingTimes_;
    std::sort(sorted.begin(), sorted.end());
    
    size_t mid = sorted.size() / 2;
    if (sorted.size() % 2 == 0) {
        return (sorted[mid - 1] + sorted[mid]) / 2.0;
    } else {
        return sorted[mid];
    }
}

double ThinkingService::getP95ProcessingTimeMs() const {
    std::lock_guard<std::mutex> lock(statsMutex_);
    
    if (processingTimes_.empty()) {
        return 0.0;
    }
    
    std::vector<double> sorted = processingTimes_;
    std::sort(sorted.begin(), sorted.end());
    
    size_t index = static_cast<size_t>(0.95 * sorted.size());
    if (index >= sorted.size()) {
        index = sorted.size() - 1;
    }
    
    return sorted[index];
}

double ThinkingService::getP99ProcessingTimeMs() const {
    std::lock_guard<std::mutex> lock(statsMutex_);
    
    if (processingTimes_.empty()) {
        return 0.0;
    }
    
    std::vector<double> sorted = processingTimes_;
    std::sort(sorted.begin(), sorted.end());
    
    size_t index = static_cast<size_t>(0.99 * sorted.size());
    if (index >= sorted.size()) {
        index = sorted.size() - 1;
    }
    
    return sorted[index];
}

std::map<std::string, double> ThinkingService::getDetailedStatistics() const {
    std::lock_guard<std::mutex> lock(statsMutex_);
    
    std::map<std::string, double> stats;
    
    stats["processedCount"] = processedCount_;
    stats["failedCount"] = failedCount_;
    stats["cancelledCount"] = cancelledCount_;
    stats["timeoutCount"] = timeoutCount_;
    stats["averageTimeMs"] = getAverageProcessingTimeMs();
    stats["medianTimeMs"] = getMedianProcessingTimeMs();
    stats["p95TimeMs"] = getP95ProcessingTimeMs();
    stats["p99TimeMs"] = getP99ProcessingTimeMs();
    stats["totalSamples"] = processingTimes_.size();
    
    return stats;
}

void ThinkingService::resetStatistics() {
    std::lock_guard<std::mutex> lock(statsMutex_);
    processedCount_ = 0;
    failedCount_ = 0;
    cancelledCount_ = 0;
    timeoutCount_ = 0;
    processingTimes_.clear();
}

bool ThinkingService::isHealthy() const {
    return running_ && failedCount_ < (processedCount_ * 0.1);
}

std::string ThinkingService::getHealthStatus() const {
    if (!running_) {
        return "stopped";
    }
    
    double failureRate = processingTimes_.empty() ? 0.0 : 
                          static_cast<double>(failedCount_) / processedCount_;
    
    if (failureRate > 0.5) {
        return "unhealthy";
    } else if (failureRate > 0.1) {
        return "degraded";
    } else {
        return "healthy";
    }
}

std::map<std::string, std::string> ThinkingService::getDiagnostics() const {
    std::map<std::string, std::string> diagnostics;
    
    diagnostics["running"] = running_ ? "true" : "false";
    diagnostics["processedCount"] = std::to_string(processedCount_);
    diagnostics["failedCount"] = std::to_string(failedCount_);
    diagnostics["cancelledCount"] = std::to_string(cancelledCount_);
    diagnostics["timeoutCount"] = std::to_string(timeoutCount_);
    diagnostics["queueSize"] = std::to_string(getQueueSize());
    diagnostics["maxConcurrentSessions"] = std::to_string(maxConcurrentSessions_);
    diagnostics["processingTimeoutMs"] = std::to_string(processingTimeoutMs_);
    diagnostics["maxRetries"] = std::to_string(maxRetries_);
    diagnostics["retryDelayMs"] = std::to_string(retryDelayMs_);
    diagnostics["healthStatus"] = getHealthStatus();
    
    return diagnostics;
}

void ThinkingService::workerLoop() {
    while (running_) {
        std::string sessionId;
        
        {
            std::unique_lock<std::mutex> lock(queueMutex_);
            queueCondition_.wait(lock, [this]() {
                return !processingQueue_.empty() || !running_;
            });
            
            if (!running_) {
                break;
            }
            
            if (!processingQueue_.empty()) {
                sessionId = processingQueue_.front();
                processingQueue_.pop_front();
            }
        }
        
        if (!sessionId.empty()) {
            processSessionInternal(sessionId);
        }
    }
}

void ThinkingService::processSessionInternal(const std::string& sessionId) {
    auto session = manager_->getSession(sessionId);
    if (!session) {
        return;
    }
    
    auto startTime = std::chrono::system_clock::now();
    manager_->setSessionState(sessionId, ThinkingState::THINKING);
    
    bool success = simulateThinkingProcess(sessionId);
    
    auto endTime = std::chrono::system_clock::now();
    double duration = std::chrono::duration<double, std::milli>(endTime - startTime).count();
    
    {
        std::lock_guard<std::mutex> lock(statsMutex_);
        processingTimes_.push_back(duration);
        if (success) {
            processedCount_++;
        } else {
            failedCount_++;
        }
    }
    
    manager_->setSessionState(sessionId, success ? ThinkingState::COMPLETED : ThinkingState::ERROR);
    manager_->notifyCompletion(success, sessionId);
}

bool ThinkingService::simulateThinkingProcess(const std::string& sessionId) {
    auto session = manager_->getSession(sessionId);
    if (!session) {
        return false;
    }
    
    // Process each step in order
    for (auto& step : session->steps) {
        if (!running_) {
            manager_->setSessionState(sessionId, ThinkingState::CANCELLED);
            cancelledCount_++;
            return false;
        }
        
        // Mark step as active
        manager_->updateStepStatus(sessionId, step.id, StepStatus::ACTIVE);
        
        // Simulate processing time (random between 100-500ms)
        int processingTime = 100 + (rand() % 400);
        std::this_thread::sleep_for(std::chrono::milliseconds(processingTime));
        
        // Mark step as done
        manager_->updateStepStatus(sessionId, step.id, StepStatus::DONE);
    }
    
    return true;
}

bool ThinkingService::processStepInternal(const std::string& sessionId, const std::string& stepId) {
    auto session = manager_->getSession(sessionId);
    if (!session) {
        return false;
    }
    
    // Find the step and process it
    for (auto& step : session->steps) {
        if (step.id == stepId) {
            manager_->updateStepStatus(sessionId, stepId, StepStatus::ACTIVE);
            
            // Simulate processing time
            std::this_thread::sleep_for(std::chrono::milliseconds(100 + (rand() % 200)));
            
            manager_->updateStepStatus(sessionId, stepId, StepStatus::DONE);
            return true;
        }
    }
    
    return false;
}

void ThinkingService::handleTimeout(const std::string& sessionId) {
    manager_->setSessionState(sessionId, ThinkingState::TIMEOUT);
    timeoutCount_++;
    manager_->notifyError(sessionId, "Processing timeout");
}

void ThinkingService::handleFailure(const std::string& sessionId, const std::string& error) {
    manager_->setSessionState(sessionId, ThinkingState::ERROR);
    manager_->notifyError(sessionId, error);
}

void ThinkingService::recordProcessingTime(double durationMs) {
    std::lock_guard<std::mutex> lock(statsMutex_);
    processingTimes_.push_back(durationMs);
}

// ============================================================================
// BinarySerializer Implementation
// ============================================================================

BinarySerializer::BinarySerializer()
    : position_(0) {
}

BinarySerializer::~BinarySerializer() {
}

void BinarySerializer::writeInt8(int8_t value) {
    buffer_.push_back(static_cast<uint8_t>(value));
}

void BinarySerializer::writeInt16(int16_t value) {
    uint8_t bytes[2];
    bytes[0] = static_cast<uint8_t>(value & 0xFF);
    bytes[1] = static_cast<uint8_t>((value >> 8) & 0xFF);
    buffer_.insert(buffer_.end(), bytes, bytes + 2);
}

void BinarySerializer::writeInt32(int32_t value) {
    uint8_t bytes[4];
    bytes[0] = static_cast<uint8_t>(value & 0xFF);
    bytes[1] = static_cast<uint8_t>((value >> 8) & 0xFF);
    bytes[2] = static_cast<uint8_t>((value >> 16) & 0xFF);
    bytes[3] = static_cast<uint8_t>((value >> 24) & 0xFF);
    buffer_.insert(buffer_.end(), bytes, bytes + 4);
}

void BinarySerializer::writeInt64(int64_t value) {
    uint8_t bytes[8];
    for (int i = 0; i < 8; ++i) {
        bytes[i] = static_cast<uint8_t>((value >> (i * 8)) & 0xFF);
    }
    buffer_.insert(buffer_.end(), bytes, bytes + 8);
}

void BinarySerializer::writeUInt8(uint8_t value) {
    buffer_.push_back(value);
}

void BinarySerializer::writeUInt16(uint16_t value) {
    uint8_t bytes[2];
    bytes[0] = static_cast<uint8_t>(value & 0xFF);
    bytes[1] = static_cast<uint8_t>((value >> 8) & 0xFF);
    buffer_.insert(buffer_.end(), bytes, bytes + 2);
}

void BinarySerializer::writeUInt32(uint32_t value) {
    uint8_t bytes[4];
    bytes[0] = static_cast<uint8_t>(value & 0xFF);
    bytes[1] = static_cast<uint8_t>((value >> 8) & 0xFF);
    bytes[2] = static_cast<uint8_t>((value >> 16) & 0xFF);
    bytes[3] = static_cast<uint8_t>((value >> 24) & 0xFF);
    buffer_.insert(buffer_.end(), bytes, bytes + 4);
}

void BinarySerializer::writeUInt64(uint64_t value) {
    uint8_t bytes[8];
    for (int i = 0; i < 8; ++i) {
        bytes[i] = static_cast<uint8_t>((value >> (i * 8)) & 0xFF);
    }
    buffer_.insert(buffer_.end(), bytes, bytes + 8);
}

void BinarySerializer::writeFloat(float value) {
    static_assert(sizeof(float) == 4, "Float must be 4 bytes");
    uint32_t* ptr = reinterpret_cast<uint32_t*>(&value);
    writeUInt32(*ptr);
}

void BinarySerializer::writeDouble(double value) {
    static_assert(sizeof(double) == 8, "Double must be 8 bytes");
    uint64_t* ptr = reinterpret_cast<uint64_t*>(&value);
    writeUInt64(*ptr);
}

void BinarySerializer::writeBool(bool value) {
    buffer_.push_back(value ? 1 : 0);
}

void BinarySerializer::writeString(const std::string& value) {
    writeInt32(static_cast<int32_t>(value.size()));
    buffer_.insert(buffer_.end(), value.begin(), value.end());
}

void BinarySerializer::writeBytes(const std::vector<uint8_t>& value) {
    writeInt32(static_cast<int32_t>(value.size()));
    buffer_.insert(buffer_.end(), value.begin(), value.end());
}

int8_t BinarySerializer::readInt8() {
    if (position_ + 1 > buffer_.size()) {
        throw std::runtime_error("Buffer underflow");
    }
    return static_cast<int8_t>(buffer_[position_++]);
}

int16_t BinarySerializer::readInt16() {
    if (position_ + 2 > buffer_.size()) {
        throw std::runtime_error("Buffer underflow");
    }
    int16_t value = static_cast<int16_t>(buffer_[position_]) |
                    (static_cast<int16_t>(buffer_[position_ + 1]) << 8);
    position_ += 2;
    return value;
}

int32_t BinarySerializer::readInt32() {
    if (position_ + 4 > buffer_.size()) {
        throw std::runtime_error("Buffer underflow");
    }
    int32_t value = static_cast<int32_t>(buffer_[position_]) |
                    (static_cast<int32_t>(buffer_[position_ + 1]) << 8) |
                    (static_cast<int32_t>(buffer_[position_ + 2]) << 16) |
                    (static_cast<int32_t>(buffer_[position_ + 3]) << 24);
    position_ += 4;
    return value;
}

int64_t BinarySerializer::readInt64() {
    if (position_ + 8 > buffer_.size()) {
        throw std::runtime_error("Buffer underflow");
    }
    int64_t value = 0;
    for (int i = 0; i < 8; ++i) {
        value |= (static_cast<int64_t>(buffer_[position_ + i]) << (i * 8));
    }
    position_ += 8;
    return value;
}

uint8_t BinarySerializer::readUInt8() {
    if (position_ + 1 > buffer_.size()) {
        throw std::runtime_error("Buffer underflow");
    }
    return buffer_[position_++];
}

uint16_t BinarySerializer::readUInt16() {
    if (position_ + 2 > buffer_.size()) {
        throw std::runtime_error("Buffer underflow");
    }
    uint16_t value = static_cast<uint16_t>(buffer_[position_]) |
                     (static_cast<uint16_t>(buffer_[position_ + 1]) << 8);
    position_ += 2;
    return value;
}

uint32_t BinarySerializer::readUInt32() {
    if (position_ + 4 > buffer_.size()) {
        throw std::runtime_error("Buffer underflow");
    }
    uint32_t value = static_cast<uint32_t>(buffer_[position_]) |
                     (static_cast<uint32_t>(buffer_[position_ + 1]) << 8) |
                     (static_cast<uint32_t>(buffer_[position_ + 2]) << 16) |
                     (static_cast<uint32_t>(buffer_[position_ + 3]) << 24);
    position_ += 4;
    return value;
}

uint64_t BinarySerializer::readUInt64() {
    if (position_ + 8 > buffer_.size()) {
        throw std::runtime_error("Buffer underflow");
    }
    uint64_t value = 0;
    for (int i = 0; i < 8; ++i) {
        value |= (static_cast<uint64_t>(buffer_[position_ + i]) << (i * 8));
    }
    position_ += 8;
    return value;
}

float BinarySerializer::readFloat() {
    if (position_ + 4 > buffer_.size()) {
        throw std::runtime_error("Buffer underflow");
    }
    uint32_t value = readUInt32();
    return *reinterpret_cast<float*>(&value);
}

double BinarySerializer::readDouble() {
    if (position_ + 8 > buffer_.size()) {
        throw std::runtime_error("Buffer underflow");
    }
    uint64_t value = readUInt64();
    return *reinterpret_cast<double*>(&value);
}

bool BinarySerializer::readBool() {
    if (position_ + 1 > buffer_.size()) {
        throw std::runtime_error("Buffer underflow");
    }
    return buffer_[position_++] != 0;
}

std::string BinarySerializer::readString() {
    int32_t length = readInt32();
    if (position_ + length > buffer_.size()) {
        throw std::runtime_error("Buffer underflow");
    }
    std::string value(buffer_.begin() + position_, buffer_.begin() + position_ + length);
    position_ += length;
    return value;
}

std::vector<uint8_t> BinarySerializer::readBytes() {
    int32_t length = readInt32();
    if (position_ + length > buffer_.size()) {
        throw std::runtime_error("Buffer underflow");
    }
    std::vector<uint8_t> value(buffer_.begin() + position_, buffer_.begin() + position_ + length);
    position_ += length;
    return value;
}

std::vector<uint8_t> BinarySerializer::getData() const {
    return buffer_;
}

void BinarySerializer::setData(const std::vector<uint8_t>& data) {
    buffer_ = data;
    position_ = 0;
}

void BinarySerializer::clear() {
    buffer_.clear();
    position_ = 0;
}

size_t BinarySerializer::size() const {
    return buffer_.size();
}

void BinarySerializer::writeToFile(const std::string& filename) const {
    std::ofstream file(filename, std::ios::binary);
    if (!file.is_open()) {
        throw SerializationException("Cannot open file for writing: " + filename);
    }
    file.write(reinterpret_cast<const char*>(buffer_.data()), buffer_.size());
}

void BinarySerializer::readFromFile(const std::string& filename) {
    std::ifstream file(filename, std::ios::binary | std::ios::ate);
    if (!file.is_open()) {
        throw SerializationException("Cannot open file for reading: " + filename);
    }
    
    size_t fileSize = file.tellg();
    file.seekg(0, std::ios::beg);
    
    buffer_.resize(fileSize);
    file.read(reinterpret_cast<char*>(buffer_.data()), fileSize);
    position_ = 0;
}

// ============================================================================
// PersistenceManager Implementation
// ============================================================================

PersistenceManager& PersistenceManager::getInstance() {
    static PersistenceManager instance;
    return instance;
}

void PersistenceManager::setBackend(PersistenceBackend backend) {
    std::lock_guard<std::mutex> lock(mutex_);
    backend_ = backend;
}

PersistenceBackend PersistenceManager::getBackend() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return backend_;
}

void PersistenceManager::setConnectionString(const std::string& connectionString) {
    std::lock_guard<std::mutex> lock(mutex_);
    connectionString_ = connectionString;
}

std::string PersistenceManager::getConnectionString() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return connectionString_;
}

bool PersistenceManager::connect() {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (backend_ == PersistenceBackend::MEMORY) {
        connected_ = true;
        return true;
    }
    
    if (backend_ == PersistenceBackend::FILE) {
        if (!fs::exists(connectionString_)) {
            fs::create_directories(connectionString_);
        }
        connected_ = fs::exists(connectionString_);
        return connected_;
    }
    
    // For other backends, would need actual database connections
    connected_ = true;
    return true;
}

void PersistenceManager::disconnect() {
    std::lock_guard<std::mutex> lock(mutex_);
    connected_ = false;
}

bool PersistenceManager::isConnected() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return connected_;
}

bool PersistenceManager::saveSession(const ThinkingSession& session) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    switch (backend_) {
        case PersistenceBackend::FILE:
            return saveSessionToFile(session);
        case PersistenceBackend::MEMORY:
            return saveSessionToMemory(session);
        default:
            return false;
    }
}

bool PersistenceManager::loadSession(const std::string& sessionId, ThinkingSession& session) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    switch (backend_) {
        case PersistenceBackend::FILE:
            return loadSessionFromFile(sessionId, session);
        case PersistenceBackend::MEMORY:
            return loadSessionFromMemory(sessionId, session);
        default:
            return false;
    }
}

bool PersistenceManager::deleteSession(const std::string& sessionId) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    switch (backend_) {
        case PersistenceBackend::FILE:
            return deleteSessionFromFile(sessionId);
        case PersistenceBackend::MEMORY:
            return deleteSessionFromMemory(sessionId);
        default:
            return false;
    }
}

bool PersistenceManager::sessionExists(const std::string& sessionId) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    switch (backend_) {
        case PersistenceBackend::FILE:
            return sessionExistsInFile(sessionId);
        case PersistenceBackend::MEMORY:
            return memoryStorage_.find(sessionId) != memoryStorage_.end();
        default:
            return false;
    }
}

std::vector<std::string> PersistenceManager::getAllSessionIds() const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (backend_ == PersistenceBackend::MEMORY) {
        std::vector<std::string> ids;
        for (const auto& [id, _] : memoryStorage_) {
            ids.push_back(id);
        }
        return ids;
    }
    
    if (backend_ == PersistenceBackend::FILE) {
        std::vector<std::string> ids;
        if (fs::exists(connectionString_)) {
            for (const auto& entry : fs::directory_iterator(connectionString_)) {
                if (entry.path().extension() == ".json") {
                    ids.push_back(entry.path().stem().string());
                }
            }
        }
        return ids;
    }
    
    return {};
}

std::vector<ThinkingSession> PersistenceManager::loadAllSessions() const {
    std::vector<ThinkingSession> sessions;
    auto ids = getAllSessionIds();
    
    for (const auto& id : ids) {
        ThinkingSession session;
        if (const_cast<PersistenceManager*>(this)->loadSession(id, session)) {
            sessions.push_back(session);
        }
    }
    
    return sessions;
}

std::vector<ThinkingSession> PersistenceManager::loadSessionsByUserId(const std::string& userId) const {
    std::vector<ThinkingSession> result;
    auto sessions = loadAllSessions();
    
    for (const auto& session : sessions) {
        if (session.userId == userId) {
            result.push_back(session);
        }
    }
    
    return result;
}

std::vector<ThinkingSession> PersistenceManager::loadSessionsByDateRange(
    const std::chrono::system_clock::time_point& start,
    const std::chrono::system_clock::time_point& end) const {
    
    std::vector<ThinkingSession> result;
    auto sessions = loadAllSessions();
    
    for (const auto& session : sessions) {
        if (session.startTime >= start && session.startTime <= end) {
            result.push_back(session);
        }
    }
    
    return result;
}

bool PersistenceManager::saveMetadata(const std::string& key, const std::string& value) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (backend_ == PersistenceBackend::FILE) {
        std::string path = utils::joinPath(connectionString_, "metadata_" + key + ".txt");
        std::ofstream file(path);
        if (!file.is_open()) {
            return false;
        }
        file << value;
        return true;
    }
    
    return false;
}

bool PersistenceManager::loadMetadata(const std::string& key, std::string& value) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (backend_ == PersistenceBackend::FILE) {
        std::string path = utils::joinPath(connectionString_, "metadata_" + key + ".txt");
        std::ifstream file(path);
        if (!file.is_open()) {
            return false;
        }
        std::getline(file, value);
        return true;
    }
    
    return false;
}

bool PersistenceManager::deleteMetadata(const std::string& key) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (backend_ == PersistenceBackend::FILE) {
        std::string path = utils::joinPath(connectionString_, "metadata_" + key + ".txt");
        return fs::remove(path);
    }
    
    return false;
}

void PersistenceManager::beginTransaction() {
    // Placeholder for transaction support
}

void PersistenceManager::commitTransaction() {
    // Placeholder for transaction support
}

void PersistenceManager::rollbackTransaction() {
    // Placeholder for transaction support
}

void PersistenceManager::setMaxConnections(int maxConnections) {
    std::lock_guard<std::mutex> lock(mutex_);
    maxConnections_ = maxConnections;
}

void PersistenceManager::setConnectionTimeout(int timeoutMs) {
    std::lock_guard<std::mutex> lock(mutex_);
    connectionTimeout_ = timeoutMs;
}

bool PersistenceManager::saveSessionToFile(const ThinkingSession& session) {
    std::string path = utils::joinPath(connectionString_, session.id + ".json");
    
    ThinkingManager tempManager;
    std::string json = tempManager.sessionToJson(session.id);
    
    std::ofstream file(path);
    if (!file.is_open()) {
        return false;
    }
    
    file << json;
    return true;
}

bool PersistenceManager::loadSessionFromFile(const std::string& sessionId, ThinkingSession& session) {
    std::string path = utils::joinPath(connectionString_, sessionId + ".json");
    
    std::ifstream file(path);
    if (!file.is_open()) {
        return false;
    }
    
    std::string content((std::istreambuf_iterator<char>(file)),
                       std::istreambuf_iterator<char>());
    
    // Parse JSON and populate session (simplified)
    session.id = sessionId;
    session.startTime = std::chrono::system_clock::now();
    
    return true;
}

bool PersistenceManager::deleteSessionFromFile(const std::string& sessionId) {
    std::string path = utils::joinPath(connectionString_, sessionId + ".json");
    return fs::remove(path);
}

bool PersistenceManager::sessionExistsInFile(const std::string& sessionId) const {
    std::string path = utils::joinPath(connectionString_, sessionId + ".json");
    return fs::exists(path);
}

bool PersistenceManager::saveSessionToMemory(const ThinkingSession& session) {
    memoryStorage_[session.id] = session;
    return true;
}

bool PersistenceManager::loadSessionFromMemory(const std::string& sessionId, ThinkingSession& session) {
    auto it = memoryStorage_.find(sessionId);
    if (it == memoryStorage_.end()) {
        return false;
    }
    session = it->second;
    return true;
}

bool PersistenceManager::deleteSessionFromMemory(const std::string& sessionId) {
    return memoryStorage_.erase(sessionId) > 0;
}

// ============================================================================
// Profiler Implementation
// ============================================================================

Profiler::ScopedTimer::ScopedTimer(const std::string& name)
    : name_(name)
    , stopped_(false) {
    startTime_ = std::chrono::high_resolution_clock::now();
}

Profiler::ScopedTimer::~ScopedTimer() {
    if (!stopped_) {
        stop();
    }
}

void Profiler::ScopedTimer::stop() {
    if (stopped_) return;
    
    endTime_ = std::chrono::high_resolution_clock::now();
    double elapsed = std::chrono::duration<double, std::milli>(endTime_ - startTime_).count();
    
    Profiler::getInstance().recordTiming(name_, elapsed);
    stopped_ = true;
}

double Profiler::ScopedTimer::getElapsedMs() const {
    auto endTime = stopped_ ? endTime_ : std::chrono::high_resolution_clock::now();
    return std::chrono::duration<double, std::milli>(endTime - startTime_).count();
}

Profiler& Profiler::getInstance() {
    static Profiler instance;
    return instance;
}

void Profiler::startTiming(const std::string& name) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto& timing = timings_[name];
    timing.samples.push_back(0.0); // Placeholder, will be updated on stop
}

void Profiler::stopTiming(const std::string& name) {
    // This would need to track active timers
}

void Profiler::recordTiming(const std::string& name, double durationMs) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto& timing = timings_[name];
    timing.samples.push_back(durationMs);
    timing.total += durationMs;
    
    if (timing.samples.size() == 1) {
        timing.min = durationMs;
        timing.max = durationMs;
    } else {
        timing.min = std::min(timing.min, durationMs);
        timing.max = std::max(timing.max, durationMs);
    }
}

double Profiler::getTiming(const std::string& name) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto it = timings_.find(name);
    return (it != timings_.end()) ? it->second.total : 0.0;
}

double Profiler::getAverageTiming(const std::string& name) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto it = timings_.find(name);
    if (it == timings_.end() || it->second.samples.empty()) {
        return 0.0;
    }
    
    return it->second.total / it->second.samples.size();
}

double Profiler::getMinTiming(const std::string& name) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto it = timings_.find(name);
    return (it != timings_.end()) ? it->second.min : 0.0;
}

double Profiler::getMaxTiming(const std::string& name) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto it = timings_.find(name);
    return (it != timings_.end()) ? it->second.max : 0.0;
}

size_t Profiler::getTimingCount(const std::string& name) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto it = timings_.find(name);
    return (it != timings_.end()) ? it->second.samples.size() : 0;
}

void Profiler::incrementCounter(const std::string& name, int64_t delta) {
    std::lock_guard<std::mutex> lock(mutex_);
    counters_[name] += delta;
}

int64_t Profiler::getCounter(const std::string& name) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto it = counters_.find(name);
    return (it != counters_.end()) ? it->second : 0;
}

void Profiler::setMemoryMarker(const std::string& name) {
    std::lock_guard<std::mutex> lock(mutex_);
    memoryMarkers_[name] = getMemoryUsage();
}

size_t Profiler::getMemoryUsage() const {
    // Platform-specific memory tracking
    // This is a simplified implementation
    return 0;
}

size_t Profiler::getMemoryDelta(const std::string& marker) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto it = memoryMarkers_.find(marker);
    if (it == memoryMarkers_.end()) {
        return 0;
    }
    
    return getMemoryUsage() - it->second;
}

void Profiler::reset() {
    std::lock_guard<std::mutex> lock(mutex_);
    timings_.clear();
    counters_.clear();
    memoryMarkers_.clear();
}

void Profiler::resetTiming(const std::string& name) {
    std::lock_guard<std::mutex> lock(mutex_);
    timings_.erase(name);
}

void Profiler::resetCounter(const std::string& name) {
    std::lock_guard<std::mutex> lock(mutex_);
    counters_.erase(name);
}

std::string Profiler::generateReport() const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    std::stringstream ss;
    ss << "=== Profiler Report ===" << std::endl;
    ss << std::endl;
    
    ss << "Timings:" << std::endl;
    for (const auto& [name, timing] : timings_) {
        double avg = timing.total / timing.samples.size();
        ss << "  " << name << ":" << std::endl;
        ss << "    Samples: " << timing.samples.size() << std::endl;
        ss << "    Total: " << timing.total << "ms" << std::endl;
        ss << "    Average: " << avg << "ms" << std::endl;
        ss << "    Min: " << timing.min << "ms" << std::endl;
        ss << "    Max: " << timing.max << "ms" << std::endl;
    }
    ss << std::endl;
    
    ss << "Counters:" << std::endl;
    for (const auto& [name, value] : counters_) {
        ss << "  " << name << ": " << value << std::endl;
    }
    
    return ss.str();
}

void Profiler::exportToJson(const std::string& filename) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    std::ofstream file(filename);
    if (!file.is_open()) {
        throw SerializationException("Cannot open file for export: " + filename);
    }
    
    file << "{";
    
    // Timings
    file << "\"timings\":{";
    bool first = true;
    for (const auto& [name, timing] : timings_) {
        if (!first) file << ",";
        double avg = timing.total / timing.samples.size();
        file << "\"" << name << "\":{";
        file << "\"samples\":" << timing.samples.size() << ",";
        file << "\"total\":" << timing.total << ",";
        file << "\"average\":" << avg << ",";
        file << "\"min\":" << timing.min << ",";
        file << "\"max\":" << timing.max;
        file << "}";
        first = false;
    }
    file << "},";
    
    // Counters
    file << "\"counters\":{";
    first = true;
    for (const auto& [name, value] : counters_) {
        if (!first) file << ",";
        file << "\"" << name << "\":" << value;
        first = false;
    }
    file << "}";
    
    file << "}";
}

// ============================================================================
// I18n Implementation
// ============================================================================

I18n& I18n::getInstance() {
    static I18n instance;
    return instance;
}

void I18n::setLocale(const std::string& locale) {
    std::lock_guard<std::mutex> lock(mutex_);
    currentLocale_ = locale;
}

std::string I18n::getLocale() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return currentLocale_;
}

void I18n::loadTranslations(const std::string& filename) {
    std::lock_guard<std::mutex> lock(mutex_);
    // Load translations from file (simplified)
}

void I18n::loadTranslationsFromString(const std::string& json) {
    std::lock_guard<std::mutex> lock(mutex_);
    // Parse JSON translations (simplified)
}

void I18n::addTranslation(const std::string& key, const std::string& value) {
    std::lock_guard<std::mutex> lock(mutex_);
    translations_[currentLocale_][key] = value;
}

std::string I18n::translate(const std::string& key) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto localeIt = translations_.find(currentLocale_);
    if (localeIt != translations_.end()) {
        auto keyIt = localeIt->second.find(key);
        if (keyIt != localeIt->second.end()) {
            return keyIt->second;
        }
    }
    
    // Try fallback locale
    if (!fallbackLocale_.empty()) {
        localeIt = translations_.find(fallbackLocale_);
        if (localeIt != translations_.end()) {
            auto keyIt = localeIt->second.find(key);
            if (keyIt != localeIt->second.end()) {
                return keyIt->second;
            }
        }
    }
    
    return key;
}

std::string I18n::translate(const std::string& key, const std::map<std::string, std::string>& placeholders) const {
    std::string result = translate(key);
    
    for (const auto& [placeholder, value] : placeholders) {
        std::string search = "{" + placeholder + "}";
        size_t pos = 0;
        while ((pos = result.find(search, pos)) != std::string::npos) {
            result.replace(pos, search.length(), value);
            pos += value.length();
        }
    }
    
    return result;
}

bool I18n::hasTranslation(const std::string& key) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto localeIt = translations_.find(currentLocale_);
    if (localeIt == translations_.end()) {
        return false;
    }
    
    return localeIt->second.find(key) != localeIt->second.end();
}

std::vector<std::string> I18n::getAvailableKeys() const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    std::vector<std::string> keys;
    
    auto localeIt = translations_.find(currentLocale_);
    if (localeIt != translations_.end()) {
        for (const auto& [key, _] : localeIt->second) {
            keys.push_back(key);
        }
    }
    
    return keys;
}

void I18n::setFallbackLocale(const std::string& locale) {
    std::lock_guard<std::mutex> lock(mutex_);
    fallbackLocale_ = locale;
}

// ============================================================================
// PluginManager Implementation
// ============================================================================

PluginManager& PluginManager::getInstance() {
    static PluginManager instance;
    return instance;
}

bool PluginManager::registerPlugin(std::shared_ptr<Plugin> plugin) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    std::string name = plugin->getName();
    if (plugins_.find(name) != plugins_.end()) {
        return false;
    }
    
    plugins_[name] = plugin;
    return true;
}

bool PluginManager::unregisterPlugin(const std::string& name) {
    std::lock_guard<std::mutex> lock(mutex_);
    return plugins_.erase(name) > 0;
}

std::shared_ptr<Plugin> PluginManager::getPlugin(const std::string& name) const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    auto it = plugins_.find(name);
    return (it != plugins_.end()) ? it->second : nullptr;
}

std::vector<std::string> PluginManager::getPluginNames() const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    std::vector<std::string> names;
    names.reserve(plugins_.size());
    
    for (const auto& [name, _] : plugins_) {
        names.push_back(name);
    }
    
    return names;
}

bool PluginManager::loadPlugin(const std::string& path) {
    // Placeholder for dynamic plugin loading
    return false;
}

bool PluginManager::unloadPlugin(const std::string& name) {
    std::shared_ptr<Plugin> plugin = getPlugin(name);
    if (!plugin) {
        return false;
    }
    
    plugin->shutdown();
    return unregisterPlugin(name);
}

void PluginManager::initializeAll() {
    std::lock_guard<std::mutex> lock(mutex_);
    
    for (auto& [name, plugin] : plugins_) {
        plugin->initialize();
    }
}

void PluginManager::shutdownAll() {
    std::lock_guard<std::mutex> lock(mutex_);
    
    for (auto& [name, plugin] : plugins_) {
        plugin->shutdown();
    }
}

void PluginManager::notifySessionCreated(const ThinkingSession& session) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    for (auto& [name, plugin] : plugins_) {
        plugin->onSessionCreated(session);
    }
}

void PluginManager::notifySessionUpdated(const ThinkingSession& session) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    for (auto& [name, plugin] : plugins_) {
        plugin->onSessionUpdated(session);
    }
}

void PluginManager::notifySessionDeleted(const std::string& sessionId) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    for (auto& [name, plugin] : plugins_) {
        plugin->onSessionDeleted(sessionId);
    }
}

void PluginManager::notifyStepCreated(const ThinkingStep& step) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    for (auto& [name, plugin] : plugins_) {
        plugin->onStepCreated(step);
    }
}

void PluginManager::notifyStepUpdated(const ThinkingStep& step) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    for (auto& [name, plugin] : plugins_) {
        plugin->onStepUpdated(step);
    }
}

// ============================================================================
// HttpClient Implementation
// ============================================================================

HttpClient& HttpClient::getInstance() {
    static HttpClient instance;
    return instance;
}

void HttpClient::setBaseUrl(const std::string& baseUrl) {
    std::lock_guard<std::mutex> lock(mutex_);
    baseUrl_ = baseUrl;
}

std::string HttpClient::getBaseUrl() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return baseUrl_;
}

void HttpClient::setDefaultHeaders(const std::map<std::string, std::string>& headers) {
    std::lock_guard<std::mutex> lock(mutex_);
    headers_ = headers;
}

void HttpClient::addHeader(const std::string& key, const std::string& value) {
    std::lock_guard<std::mutex> lock(mutex_);
    headers_[key] = value;
}

void HttpClient::removeHeader(const std::string& key) {
    std::lock_guard<std::mutex> lock(mutex_);
    headers_.erase(key);
}

void HttpClient::clearHeaders() {
    std::lock_guard<std::mutex> lock(mutex_);
    headers_.clear();
}

void HttpClient::setTimeout(int timeoutMs) {
    std::lock_guard<std::mutex> lock(mutex_);
    timeout_ = timeoutMs;
}

int HttpClient::getTimeout() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return timeout_;
}

std::string HttpClient::get(const std::string& path) {
    // Placeholder for actual HTTP GET implementation
    return "";
}

std::string HttpClient::post(const std::string& path, const std::string& body) {
    // Placeholder for actual HTTP POST implementation
    return "";
}

std::string HttpClient::put(const std::string& path, const std::string& body) {
    // Placeholder for actual HTTP PUT implementation
    return "";
}

std::string HttpClient::delete_(const std::string& path) {
    // Placeholder for actual HTTP DELETE implementation
    return "";
}

void HttpClient::setAuthentication(const std::string& type, const std::string& credentials) {
    std::lock_guard<std::mutex> lock(mutex_);
    authType_ = type;
    authCredentials_ = credentials;
}

void HttpClient::clearAuthentication() {
    std::lock_guard<std::mutex> lock(mutex_);
    authType_.clear();
    authCredentials_.clear();
}

// ============================================================================
// TestSuite Implementation
// ============================================================================

TestSuite& TestSuite::getInstance() {
    static TestSuite instance;
    return instance;
}

void TestSuite::addTest(const std::string& name, std::function<void()> testFunc) {
    std::lock_guard<std::mutex> lock(mutex_);
    tests_.emplace_back(name, testFunc);
}

void TestSuite::addTestSuite(const std::string& name, std::function<void()> setupFunc) {
    std::lock_guard<std::mutex> lock(mutex_);
    setupFunc_ = setupFunc;
}

void TestSuite::runAll() {
    std::lock_guard<std::mutex> lock(mutex_);
    
    if (setupFunc_) {
        setupFunc_();
    }
    
    for (auto& test : tests_) {
        try {
            auto startTime = std::chrono::high_resolution_clock::now();
            test.testFunc();
            auto endTime = std::chrono::high_resolution_clock::now();
            test.durationMs = std::chrono::duration<double, std::milli>(endTime - startTime).count();
            test.passed = true;
        } catch (const std::exception& e) {
            test.passed = false;
            test.errorMessage = e.what();
        }
    }
}

void TestSuite::runTest(const std::string& name) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    for (auto& test : tests_) {
        if (test.name == name) {
            try {
                auto startTime = std::chrono::high_resolution_clock::now();
                test.testFunc();
                auto endTime = std::chrono::high_resolution_clock::now();
                test.durationMs = std::chrono::duration<double, std::milli>(endTime - startTime).count();
                test.passed = true;
            } catch (const std::exception& e) {
                test.passed = false;
                test.errorMessage = e.what();
            }
            break;
        }
    }
}

void TestSuite::runSuite(const std::string& name) {
    // Placeholder for running specific test suites
}

void TestSuite::setUp() {
    if (setupFunc_) {
        setupFunc_();
    }
}

void TestSuite::tearDown() {
    if (teardownFunc_) {
        teardownFunc_();
    }
}

void TestSuite::assertEqual(int expected, int actual, const std::string& message) {
    if (expected != actual) {
        throw std::runtime_error(message.empty() ? 
            "Assertion failed: expected " + std::to_string(expected) + 
            " but got " + std::to_string(actual) : message);
    }
}

void TestSuite::assertNotEqual(int expected, int actual, const std::string& message) {
    if (expected == actual) {
        throw std::runtime_error(message.empty() ? 
            "Assertion failed: values should not be equal" : message);
    }
}

void TestSuite::assertTrue(bool condition, const std::string& message) {
    if (!condition) {
        throw std::runtime_error(message.empty() ? "Assertion failed: condition is false" : message);
    }
}

void TestSuite::assertFalse(bool condition, const std::string& message) {
    if (condition) {
        throw std::runtime_error(message.empty() ? "Assertion failed: condition is true" : message);
    }
}

void TestSuite::assertNull(const void* ptr, const std::string& message) {
    if (ptr != nullptr) {
        throw std::runtime_error(message.empty() ? "Assertion failed: pointer is not null" : message);
    }
}

void TestSuite::assertNotNull(const void* ptr, const std::string& message) {
    if (ptr == nullptr) {
        throw std::runtime_error(message.empty() ? "Assertion failed: pointer is null" : message);
    }
}

void TestSuite::assertThrows(std::function<void()> func, const std::string& message) {
    bool threw = false;
    try {
        func();
    } catch (...) {
        threw = true;
    }
    
    if (!threw) {
        throw std::runtime_error(message.empty() ? "Assertion failed: expected exception" : message);
    }
}

void TestSuite::generateReport(const std::string& format) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    int passed = 0;
    int failed = 0;
    double totalDuration = 0.0;
    
    for (const auto& test : tests_) {
        if (test.passed) {
            passed++;
        } else {
            failed++;
        }
        totalDuration += test.durationMs;
    }
    
    std::cout << "=== Test Report ===" << std::endl;
    std::cout << "Total: " << tests_.size() << std::endl;
    std::cout << "Passed: " << passed << std::endl;
    std::cout << "Failed: " << failed << std::endl;
    std::cout << "Duration: " << totalDuration << "ms" << std::endl;
    
    if (failed > 0) {
        std::cout << std::endl << "Failed tests:" << std::endl;
        for (const auto& test : tests_) {
            if (!test.passed) {
                std::cout << "  " << test.name << ": " << test.errorMessage << std::endl;
            }
        }
    }
}

void TestSuite::exportResults(const std::string& filename) {
    std::lock_guard<std::mutex> lock(mutex_);
    
    std::ofstream file(filename);
    if (!file.is_open()) {
        throw SerializationException("Cannot open file for export: " + filename);
    }
    
    file << "{";
    file << "\"tests\":[";
    
    bool first = true;
    for (const auto& test : tests_) {
        if (!first) file << ",";
        file << "{";
        file << "\"name\":\"" << test.name << "\",";
        file << "\"passed\":" << (test.passed ? "true" : "false") << ",";
        file << "\"durationMs\":" << test.durationMs;
        if (!test.errorMessage.empty()) {
            file << ",\"errorMessage\":\"" << test.errorMessage << "\"";
        }
        file << "}";
        first = false;
    }
    
    file << "],";
    file << "\"passed\":" << getPassedCount() << ",";
    file << "\"failed\":" << getFailedCount() << ",";
    file << "\"totalDurationMs\":" << getTotalDurationMs();
    file << "}";
}

int TestSuite::getPassedCount() const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    int count = 0;
    for (const auto& test : tests_) {
        if (test.passed) count++;
    }
    return count;
}

int TestSuite::getFailedCount() const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    int count = 0;
    for (const auto& test : tests_) {
        if (!test.passed) count++;
    }
    return count;
}

double TestSuite::getTotalDurationMs() const {
    std::lock_guard<std::mutex> lock(mutex_);
    
    double total = 0.0;
    for (const auto& test : tests_) {
        total += test.durationMs;
    }
    return total;
}

// ============================================================================
// Utility Functions Implementation
// ============================================================================

namespace utils {

std::string generateId() {
    static std::random_device rd;
    static std::mt19937 gen(rd());
    static std::uniform_int_distribution<> dis(100000, 999999);
    
    std::stringstream ss;
    ss << "step_" << std::hex << std::setfill('0') << std::setw(8) 
       << dis(gen) << "_" << std::chrono::system_clock::now().time_since_epoch().count();
    return ss.str();
}

std::string generateUuid() {
    static std::random_device rd;
    static std::mt19937 gen(rd());
    static std::uniform_int_distribution<> dis(0, 255);
    
    std::stringstream ss;
    for (int i = 0; i < 16; ++i) {
        if (i == 4 || i == 6 || i == 8 || i == 10) {
            ss << "-";
        }
        int value = dis(gen);
        ss << std::hex << std::setw(2) << std::setfill('0') << value;
    }
    
    return ss.str();
}

std::string generateShortId(size_t length) {
    static const char charset[] = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    static std::random_device rd;
    static std::mt19937 gen(rd());
    static std::uniform_int_distribution<> dis(0, sizeof(charset) - 2);
    
    std::string result;
    result.reserve(length);
    
    for (size_t i = 0; i < length; ++i) {
        result += charset[dis(gen)];
    }
    
    return result;
}

std::string getCurrentTimestamp() {
    auto now = std::chrono::system_clock::now();
    auto time = std::chrono::system_clock::to_time_t(now);
    std::stringstream ss;
    ss << std::put_time(std::localtime(&time), "%Y-%m-%dT%H:%M:%S");
    return ss.str();
}

std::string getCurrentTimestamp(const std::string& format) {
    auto now = std::chrono::system_clock::now();
    auto time = std::chrono::system_clock::to_time_t(now);
    std::stringstream ss;
    ss << std::put_time(std::localtime(&time), format.c_str());
    return ss.str();
}

std::chrono::system_clock::time_point parseTimestamp(const std::string& timestamp) {
    std::tm tm = {};
    std::istringstream ss(timestamp);
    ss >> std::get_time(&tm, "%Y-%m-%dT%H:%M:%S");
    return std::chrono::system_clock::from_time_t(std::mktime(&tm));
}

std::string statusToString(StepStatus status) {
    switch (status) {
        case StepStatus::PENDING: return "pending";
        case StepStatus::ACTIVE: return "active";
        case StepStatus::DONE: return "done";
        case StepStatus::FAILED: return "failed";
        case StepStatus::CANCELLED: return "cancelled";
        case StepStatus::SKIPPED: return "skipped";
        default: return "unknown";
    }
}

std::string stateToString(ThinkingState state) {
    switch (state) {
        case ThinkingState::IDLE: return "idle";
        case ThinkingState::THINKING: return "thinking";
        case ThinkingState::PAUSED: return "paused";
        case ThinkingState::COMPLETED: return "completed";
        case ThinkingState::ERROR: return "error";
        case ThinkingState::CANCELLED: return "cancelled";
        case ThinkingState::TIMEOUT: return "timeout";
        default: return "unknown";
    }
}

std::string logLevelToString(LogLevel level) {
    switch (level) {
        case LogLevel::TRACE: return "TRACE";
        case LogLevel::DEBUG: return "DEBUG";
        case LogLevel::INFO: return "INFO";
        case LogLevel::WARNING: return "WARNING";
        case LogLevel::ERROR: return "ERROR";
        case LogLevel::CRITICAL: return "CRITICAL";
        case LogLevel::OFF: return "OFF";
        default: return "UNKNOWN";
    }
}

std::string cachePolicyToString(CacheEvictionPolicy policy) {
    switch (policy) {
        case CacheEvictionPolicy::LRU: return "LRU";
        case CacheEvictionPolicy::LFU: return "LFU";
        case CacheEvictionPolicy::FIFO: return "FIFO";
        case CacheEvictionPolicy::LIFO: return "LIFO";
        case CacheEvictionPolicy::RANDOM: return "RANDOM";
        default: return "UNKNOWN";
    }
}

std::string backendToString(PersistenceBackend backend) {
    switch (backend) {
        case PersistenceBackend::MEMORY: return "MEMORY";
        case PersistenceBackend::FILE: return "FILE";
        case PersistenceBackend::SQLITE: return "SQLITE";
        case PersistenceBackend::MYSQL: return "MYSQL";
        case PersistenceBackend::POSTGRESQL: return "POSTGRESQL";
        case PersistenceBackend::MONGODB: return "MONGODB";
        case PersistenceBackend::REDIS: return "REDIS";
        default: return "UNKNOWN";
    }
}

std::string formatToString(SerializationFormat format) {
    switch (format) {
        case SerializationFormat::JSON: return "JSON";
        case SerializationFormat::BINARY: return "BINARY";
        case SerializationFormat::XML: return "XML";
        case SerializationFormat::YAML: return "YAML";
        case SerializationFormat::PROTOBUF: return "PROTOBUF";
        default: return "UNKNOWN";
    }
}

std::string priorityToString(EventPriority priority) {
    switch (priority) {
        case EventPriority::LOW: return "LOW";
        case EventPriority::NORMAL: return "NORMAL";
        case EventPriority::HIGH: return "HIGH";
        case EventPriority::CRITICAL: return "CRITICAL";
        default: return "UNKNOWN";
    }
}

StepStatus stringToStatus(const std::string& status) {
    std::string upper = toUpper(status);
    if (upper == "PENDING") return StepStatus::PENDING;
    if (upper == "ACTIVE") return StepStatus::ACTIVE;
    if (upper == "DONE") return StepStatus::DONE;
    if (upper == "FAILED") return StepStatus::FAILED;
    if (upper == "CANCELLED") return StepStatus::CANCELLED;
    if (upper == "SKIPPED") return StepStatus::SKIPPED;
    return StepStatus::PENDING;
}

ThinkingState stringToState(const std::string& state) {
    std::string upper = toUpper(state);
    if (upper == "IDLE") return ThinkingState::IDLE;
    if (upper == "THINKING") return ThinkingState::THINKING;
    if (upper == "PAUSED") return ThinkingState::PAUSED;
    if (upper == "COMPLETED") return ThinkingState::COMPLETED;
    if (upper == "ERROR") return ThinkingState::ERROR;
    if (upper == "CANCELLED") return ThinkingState::CANCELLED;
    if (upper == "TIMEOUT") return ThinkingState::TIMEOUT;
    return ThinkingState::IDLE;
}

LogLevel stringToLogLevel(const std::string& level) {
    std::string upper = toUpper(level);
    if (upper == "TRACE") return LogLevel::TRACE;
    if (upper == "DEBUG") return LogLevel::DEBUG;
    if (upper == "INFO") return LogLevel::INFO;
    if (upper == "WARNING") return LogLevel::WARNING;
    if (upper == "ERROR") return LogLevel::ERROR;
    if (upper == "CRITICAL") return LogLevel::CRITICAL;
    if (upper == "OFF") return LogLevel::OFF;
    return LogLevel::INFO;
}

CacheEvictionPolicy stringToCachePolicy(const std::string& policy) {
    std::string upper = toUpper(policy);
    if (upper == "LRU") return CacheEvictionPolicy::LRU;
    if (upper == "LFU") return CacheEvictionPolicy::LFU;
    if (upper == "FIFO") return CacheEvictionPolicy::FIFO;
    if (upper == "LIFO") return CacheEvictionPolicy::LIFO;
    if (upper == "RANDOM") return CacheEvictionPolicy::RANDOM;
    return CacheEvictionPolicy::LRU;
}

PersistenceBackend stringToBackend(const std::string& backend) {
    std::string upper = toUpper(backend);
    if (upper == "MEMORY") return PersistenceBackend::MEMORY;
    if (upper == "FILE") return PersistenceBackend::FILE;
    if (upper == "SQLITE") return PersistenceBackend::SQLITE;
    if (upper == "MYSQL") return PersistenceBackend::MYSQL;
    if (upper == "POSTGRESQL") return PersistenceBackend::POSTGRESQL;
    if (upper == "MONGODB") return PersistenceBackend::MONGODB;
    if (upper == "REDIS") return PersistenceBackend::REDIS;
    return PersistenceBackend::MEMORY;
}

SerializationFormat stringToFormat(const std::string& format) {
    std::string upper = toUpper(format);
    if (upper == "JSON") return SerializationFormat::JSON;
    if (upper == "BINARY") return SerializationFormat::BINARY;
    if (upper == "XML") return SerializationFormat::XML;
    if (upper == "YAML") return SerializationFormat::YAML;
    if (upper == "PROTOBUF") return SerializationFormat::PROTOBUF;
    return SerializationFormat::JSON;
}

EventPriority stringToPriority(const std::string& priority) {
    std::string upper = toUpper(priority);
    if (upper == "LOW") return EventPriority::LOW;
    if (upper == "NORMAL") return EventPriority::NORMAL;
    if (upper == "HIGH") return EventPriority::HIGH;
    if (upper == "CRITICAL") return EventPriority::CRITICAL;
    return EventPriority::NORMAL;
}

std::string escapeJsonString(const std::string& str) {
    std::string result;
    result.reserve(str.size() * 1.2);
    
    for (char c : str) {
        switch (c) {
            case '"':  result += "\\\""; break;
            case '\\': result += "\\\\"; break;
            case '\b': result += "\\b"; break;
            case '\f': result += "\\f"; break;
            case '\n': result += "\\n"; break;
            case '\r': result += "\\r"; break;
            case '\t': result += "\\t"; break;
            default:
                if (c < 32) {
                    std::stringstream ss;
                    ss << "\\u" << std::hex << std::setw(4) << std::setfill('0') << static_cast<int>(c);
                    result += ss.str();
                } else {
                    result += c;
                }
        }
    }
    return result;
}

std::string unescapeJsonString(const std::string& str) {
    std::string result;
    result.reserve(str.size());
    
    for (size_t i = 0; i < str.size(); ++i) {
        if (str[i] == '\\' && i + 1 < str.size()) {
            switch (str[i + 1]) {
                case '"':  result += '"'; i++; break;
                case '\\': result += '\\'; i++; break;
                case 'b':  result += '\b'; i++; break;
                case 'f':  result += '\f'; i++; break;
                case 'n':  result += '\n'; i++; break;
                case 'r':  result += '\r'; i++; break;
                case 't':  result += '\t'; i++; break;
                case 'u': {
                    if (i + 5 < str.size()) {
                        std::string hex = str.substr(i + 2, 4);
                        int code = std::stoi(hex, nullptr, 16);
                        result += static_cast<char>(code);
                        i += 5;
                    }
                    break;
                }
                default:
                    result += str[i];
            }
        } else {
            result += str[i];
        }
    }
    
    return result;
}

std::string buildJsonPair(const std::string& key, const std::string& value) {
    return "\"" + escapeJsonString(key) + "\":\"" + escapeJsonString(value) + "\"";
}

std::string buildJsonPair(const std::string& key, int value) {
    return "\"" + escapeJsonString(key) + "\":" + std::to_string(value);
}

std::string buildJsonPair(const std::string& key, double value) {
    return "\"" + escapeJsonString(key) + "\":" + std::to_string(value);
}

std::string buildJsonPair(const std::string& key, bool value) {
    return "\"" + escapeJsonString(key) + "\":" + (value ? "true" : "false");
}

std::string toLower(const std::string& str) {
    std::string result;
    result.reserve(str.size());
    
    for (char c : str) {
        result += static_cast<char>(std::tolower(c));
    }
    
    return result;
}

std::string toUpper(const std::string& str) {
    std::string result;
    result.reserve(str.size());
    
    for (char c : str) {
        result += static_cast<char>(std::toupper(c));
    }
    
    return result;
}

std::string trim(const std::string& str) {
    return trimRight(trimLeft(str));
}

std::string trimLeft(const std::string& str) {
    size_t start = str.find_first_not_of(" \t\n\r");
    return (start == std::string::npos) ? "" : str.substr(start);
}

std::string trimRight(const std::string& str) {
    size_t end = str.find_last_not_of(" \t\n\r");
    return (end == std::string::npos) ? "" : str.substr(0, end + 1);
}

std::vector<std::string> split(const std::string& str, char delimiter) {
    std::vector<std::string> result;
    std::stringstream ss(str);
    std::string token;
    
    while (std::getline(ss, token, delimiter)) {
        result.push_back(token);
    }
    
    return result;
}

std::string join(const std::vector<std::string>& parts, const std::string& delimiter) {
    if (parts.empty()) {
        return "";
    }
    
    std::stringstream ss;
    ss << parts[0];
    
    for (size_t i = 1; i < parts.size(); ++i) {
        ss << delimiter << parts[i];
    }
    
    return ss.str();
}

std::string replace(const std::string& str, const std::string& from, const std::string& to) {
    if (from.empty()) {
        return str;
    }
    
    std::string result = str;
    size_t pos = 0;
    
    while ((pos = result.find(from, pos)) != std::string::npos) {
        result.replace(pos, from.length(), to);
        pos += to.length();
    }
    
    return result;
}

bool startsWith(const std::string& str, const std::string& prefix) {
    if (prefix.size() > str.size()) {
        return false;
    }
    return str.substr(0, prefix.size()) == prefix;
}

bool endsWith(const std::string& str, const std::string& suffix) {
    if (suffix.size() > str.size()) {
        return false;
    }
    return str.substr(str.size() - suffix.size()) == suffix;
}

bool contains(const std::string& str, const std::string& substr) {
    return str.find(substr) != std::string::npos;
}

bool isNumeric(const std::string& str) {
    if (str.empty()) return false;
    
    size_t start = 0;
    if (str[0] == '-') start = 1;
    
    bool hasDecimal = false;
    for (size_t i = start; i < str.size(); ++i) {
        if (str[i] == '.') {
            if (hasDecimal) return false;
            hasDecimal = true;
        } else if (!std::isdigit(str[i])) {
            return false;
        }
    }
    
    return true;
}

double toDouble(const std::string& str) {
    return std::stod(str);
}

int toInt(const std::string& str) {
    return std::stoi(str);
}

long toLong(const std::string& str) {
    return std::stol(str);
}

std::string toString(int value) {
    return std::to_string(value);
}

std::string toString(double value) {
    return std::to_string(value);
}

std::string toString(bool value) {
    return value ? "true" : "false";
}

std::string formatDuration(double durationMs) {
    if (durationMs < 1000) {
        return std::to_string(static_cast<int>(durationMs)) + "ms";
    } else if (durationMs < 60000) {
        return std::to_string(durationMs / 1000.0).substr(0, 4) + "s";
    } else if (durationMs < 3600000) {
        return std::to_string(durationMs / 60000.0).substr(0, 4) + "m";
    } else {
        return std::to_string(durationMs / 3600000.0).substr(0, 4) + "h";
    }
}

std::string formatDurationPrecise(double durationMs) {
    std::stringstream ss;
    ss << std::fixed << std::setprecision(2) << durationMs << "ms";
    return ss.str();
}

double parseDuration(const std::string& duration) {
    std::string upper = toUpper(duration);
    
    if (upper.find("MS") != std::string::npos) {
        return std::stod(duration.substr(0, duration.size() - 2));
    } else if (upper.find("S") != std::string::npos) {
        return std::stod(duration.substr(0, duration.size() - 1)) * 1000;
    } else if (upper.find("M") != std::string::npos) {
        return std::stod(duration.substr(0, duration.size() - 1)) * 60000;
    } else if (upper.find("H") != std::string::npos) {
        return std::stod(duration.substr(0, duration.size() - 1)) * 3600000;
    }
    
    return std::stod(duration);
}

size_t hashString(const std::string& str) {
    return std::hash<std::string>{}(str);
}

std::string md5Hash(const std::string& str) {
    // Placeholder for MD5 hash implementation
    // In production, use a proper cryptographic library
    return std::to_string(hashString(str));
}

std::string sha256Hash(const std::string& str) {
    // Placeholder for SHA-256 hash implementation
    // In production, use a proper cryptographic library
    return std::to_string(hashString(str));
}

std::string base64Encode(const std::string& str) {
    static const char charset[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    std::string result;
    
    const uint8_t* data = reinterpret_cast<const uint8_t*>(str.data());
    size_t len = str.size();
    
    for (size_t i = 0; i < len; i += 3) {
        uint32_t value = 0;
        
        if (i + 2 < len) {
            value = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
            result += charset[(value >> 18) & 0x3F];
            result += charset[(value >> 12) & 0x3F];
            result += charset[(value >> 6) & 0x3F];
            result += charset[value & 0x3F];
        } else if (i + 1 < len) {
            value = (data[i] << 16) | (data[i + 1] << 8);
            result += charset[(value >> 18) & 0x3F];
            result += charset[(value >> 12) & 0x3F];
            result += charset[(value >> 6) & 0x3F];
            result += '=';
        } else {
            value = (data[i] << 16);
            result += charset[(value >> 18) & 0x3F];
            result += charset[(value >> 12) & 0x3F];
            result += '=';
            result += '=';
        }
    }
    
    return result;
}

std::string base64Encode(const std::vector<uint8_t>& data) {
    return base64Encode(std::string(data.begin(), data.end()));
}

std::string base64Decode(const std::string& encoded) {
    static const int lookup[256] = {0};
    // Placeholder for base64 decode
    return "";
}

std::vector<uint8_t> base64DecodeToBytes(const std::string& encoded) {
    std::string decoded = base64Decode(encoded);
    return std::vector<uint8_t>(decoded.begin(), decoded.end());
}

std::string hexEncode(const std::string& str) {
    std::stringstream ss;
    for (unsigned char c : str) {
        ss << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(c);
    }
    return ss.str();
}

std::string hexEncode(const std::vector<uint8_t>& data) {
    std::stringstream ss;
    for (uint8_t byte : data) {
        ss << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(byte);
    }
    return ss.str();
}

std::string hexDecode(const std::string& encoded) {
    std::string result;
    for (size_t i = 0; i < encoded.size(); i += 2) {
        std::string byte = encoded.substr(i, 2);
        char c = static_cast<char>(std::stoi(byte, nullptr, 16));
        result += c;
    }
    return result;
}

std::vector<uint8_t> hexDecodeToBytes(const std::string& encoded) {
    std::string decoded = hexDecode(encoded);
    return std::vector<uint8_t>(decoded.begin(), decoded.end());
}

std::string urlEncode(const std::string& str) {
    std::stringstream ss;
    for (unsigned char c : str) {
        if (std::isalnum(c) || c == '-' || c == '_' || c == '.' || c == '~') {
            ss << c;
        } else {
            ss << '%' << std::hex << std::setw(2) << std::setfill('0') << static_cast<int>(c);
        }
    }
    return ss.str();
}

std::string urlDecode(const std::string& str) {
    std::string result;
    for (size_t i = 0; i < str.size(); ++i) {
        if (str[i] == '%' && i + 2 < str.size()) {
            std::string hex = str.substr(i + 1, 2);
            char c = static_cast<char>(std::stoi(hex, nullptr, 16));
            result += c;
            i += 2;
        } else {
            result += str[i];
        }
    }
    return result;
}

std::string joinPath(const std::string& base, const std::string& relative) {
    if (base.empty()) return relative;
    if (relative.empty()) return base;
    
    char last = base.back();
    if (last == '/' || last == '\\') {
        return base + relative;
    }
    
    return base + "/" + relative;
}

std::string getFileName(const std::string& path) {
    size_t pos = path.find_last_of("/\\");
    return (pos == std::string::npos) ? path : path.substr(pos + 1);
}

std::string getFileExtension(const std::string& path) {
    std::string filename = getFileName(path);
    size_t pos = filename.find_last_of('.');
    return (pos == std::string::npos) ? "" : filename.substr(pos);
}

std::string getDirectory(const std::string& path) {
    size_t pos = path.find_last_of("/\\");
    return (pos == std::string::npos) ? "" : path.substr(0, pos);
}

bool fileExists(const std::string& path) {
    return fs::exists(path);
}

bool directoryExists(const std::string& path) {
    return fs::exists(path) && fs::is_directory(path);
}

size_t fileSize(const std::string& path) {
    if (!fs::exists(path)) {
        return 0;
    }
    return fs::file_size(path);
}

bool createDirectory(const std::string& path) {
    return fs::create_directories(path);
}

bool deleteFile(const std::string& path) {
    return fs::remove(path);
}

bool deleteDirectory(const std::string& path) {
    return fs::remove_all(path);
}

int randomInt(int min, int max) {
    static std::random_device rd;
    static std::mt19937 gen(rd());
    std::uniform_int_distribution<> dis(min, max);
    return dis(gen);
}

double randomDouble(double min, double max) {
    static std::random_device rd;
    static std::mt19937 gen(rd());
    std::uniform_real_distribution<> dis(min, max);
    return dis(gen);
}

std::string randomString(size_t length) {
    static const char charset[] = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
    static std::random_device rd;
    static std::mt19937 gen(rd());
    static std::uniform_int_distribution<> dis(0, sizeof(charset) - 2);
    
    std::string result;
    result.reserve(length);
    
    for (size_t i = 0; i < length; ++i) {
        result += charset[dis(gen)];
    }
    
    return result;
}

std::string randomAlphaNumeric(size_t length) {
    return randomString(length);
}

std::string randomBytes(size_t length) {
    std::string result;
    result.reserve(length);
    
    static std::random_device rd;
    static std::mt19937 gen(rd());
    static std::uniform_int_distribution<> dis(0, 255);
    
    for (size_t i = 0; i < length; ++i) {
        result += static_cast<char>(dis(gen));
    }
    
    return result;
}

std::string compress(const std::string& data) {
    // Placeholder for compression
    return data;
}

std::string decompress(const std::string& compressed) {
    // Placeholder for decompression
    return compressed;
}

std::vector<uint8_t> compressBytes(const std::vector<uint8_t>& data) {
    // Placeholder for compression
    return data;
}

std::vector<uint8_t> decompressBytes(const std::vector<uint8_t>& compressed) {
    // Placeholder for decompression
    return compressed;
}

bool versionCompare(const std::string& v1, const std::string& v2) {
    return versionMajor(v1) > versionMajor(v2) ||
           (versionMajor(v1) == versionMajor(v2) && versionMinor(v1) > versionMinor(v2)) ||
           (versionMajor(v1) == versionMajor(v2) && versionMinor(v1) == versionMinor(v2) && versionPatch(v1) > versionPatch(v2));
}

int versionMajor(const std::string& version) {
    std::vector<std::string> parts = split(version, '.');
    return parts.size() > 0 ? toInt(parts[0]) : 0;
}

int versionMinor(const std::string& version) {
    std::vector<std::string> parts = split(version, '.');
    return parts.size() > 1 ? toInt(parts[1]) : 0;
}

int versionPatch(const std::string& version) {
    std::vector<std::string> parts = split(version, '.');
    return parts.size() > 2 ? toInt(parts[2]) : 0;
}

// Additional string manipulation functions
std::string padLeft(const std::string& str, size_t length, char padChar) {
    if (str.size() >= length) {
        return str;
    }
    return std::string(length - str.size(), padChar) + str;
}

std::string padRight(const std::string& str, size_t length, char padChar) {
    if (str.size() >= length) {
        return str;
    }
    return str + std::string(length - str.size(), padChar);
}

std::string center(const std::string& str, size_t width, char padChar) {
    if (str.size() >= width) {
        return str;
    }
    size_t padding = width - str.size();
    size_t leftPad = padding / 2;
    size_t rightPad = padding - leftPad;
    return std::string(leftPad, padChar) + str + std::string(rightPad, padChar);
}

std::string truncate(const std::string& str, size_t maxLength, const std::string& ellipsis) {
    if (str.size() <= maxLength) {
        return str;
    }
    if (ellipsis.size() >= maxLength) {
        return ellipsis.substr(0, maxLength);
    }
    return str.substr(0, maxLength - ellipsis.size()) + ellipsis;
}

std::string reverse(const std::string& str) {
    return std::string(str.rbegin(), str.rend());
}

std::string repeat(const std::string& str, size_t count) {
    std::string result;
    result.reserve(str.size() * count);
    for (size_t i = 0; i < count; ++i) {
        result += str;
    }
    return result;
}

std::string capitalize(const std::string& str) {
    if (str.empty()) {
        return str;
    }
    std::string result = str;
    result[0] = static_cast<char>(std::toupper(result[0]));
    return result;
}

std::string capitalizeWords(const std::string& str) {
    std::string result;
    bool capitalizeNext = true;
    
    for (char c : str) {
        if (std::isspace(c)) {
            capitalizeNext = true;
            result += c;
        } else if (capitalizeNext) {
            result += static_cast<char>(std::toupper(c));
            capitalizeNext = false;
        } else {
            result += static_cast<char>(std::tolower(c));
        }
    }
    
    return result;
}

std::string snakeCase(const std::string& str) {
    std::string result;
    for (char c : str) {
        if (std::isupper(c)) {
            if (!result.empty() && result.back() != '_') {
                result += '_';
            }
            result += static_cast<char>(std::tolower(c));
        } else if (c == ' ' || c == '-') {
            result += '_';
        } else {
            result += c;
        }
    }
    return result;
}

std::string camelCase(const std::string& str) {
    std::string result;
    bool capitalizeNext = false;
    
    for (char c : str) {
        if (c == '_' || c == ' ' || c == '-') {
            capitalizeNext = true;
        } else if (capitalizeNext) {
            result += static_cast<char>(std::toupper(c));
            capitalizeNext = false;
        } else {
            result += static_cast<char>(std::tolower(c));
        }
    }
    
    return result;
}

std::string pascalCase(const std::string& str) {
    std::string result;
    bool capitalizeNext = true;
    
    for (char c : str) {
        if (c == '_' || c == ' ' || c == '-') {
            capitalizeNext = true;
        } else if (capitalizeNext) {
            result += static_cast<char>(std::toupper(c));
            capitalizeNext = false;
        } else {
            result += static_cast<char>(std::tolower(c));
        }
    }
    
    return result;
}

std::string kebabCase(const std::string& str) {
    std::string result;
    for (char c : str) {
        if (std::isupper(c)) {
            if (!result.empty() && result.back() != '-') {
                result += '-';
            }
            result += static_cast<char>(std::tolower(c));
        } else if (c == '_' || c == ' ') {
            result += '-';
        } else {
            result += c;
        }
    }
    return result;
}

std::string removeDuplicates(const std::string& str) {
    std::string result;
    std::unordered_set<char> seen;
    
    for (char c : str) {
        if (seen.find(c) == seen.end()) {
            seen.insert(c);
            result += c;
        }
    }
    
    return result;
}

std::string removeWhitespace(const std::string& str) {
    std::string result;
    for (char c : str) {
        if (!std::isspace(c)) {
            result += c;
        }
    }
    return result;
}

std::string normalizeWhitespace(const std::string& str) {
    std::string result;
    bool inWhitespace = false;
    
    for (char c : str) {
        if (std::isspace(c)) {
            if (!inWhitespace) {
                result += ' ';
                inWhitespace = true;
            }
        } else {
            result += c;
            inWhitespace = false;
        }
    }
    
    return trim(result);
}

int countOccurrences(const std::string& str, char target) {
    int count = 0;
    for (char c : str) {
        if (c == target) {
            count++;
        }
    }
    return count;
}

int countOccurrences(const std::string& str, const std::string& target) {
    if (target.empty()) {
        return 0;
    }
    
    int count = 0;
    size_t pos = 0;
    
    while ((pos = str.find(target, pos)) != std::string::npos) {
        count++;
        pos += target.size();
    }
    
    return count;
}

std::vector<size_t> findAllOccurrences(const std::string& str, char target) {
    std::vector<size_t> positions;
    for (size_t i = 0; i < str.size(); ++i) {
        if (str[i] == target) {
            positions.push_back(i);
        }
    }
    return positions;
}

std::vector<size_t> findAllOccurrences(const std::string& str, const std::string& target) {
    std::vector<size_t> positions;
    if (target.empty()) {
        return positions;
    }
    
    size_t pos = 0;
    while ((pos = str.find(target, pos)) != std::string::npos) {
        positions.push_back(pos);
        pos += target.size();
    }
    
    return positions;
}

bool isPalindrome(const std::string& str) {
    std::string normalized = toLower(removeWhitespace(str));
    size_t left = 0;
    size_t right = normalized.size() - 1;
    
    while (left < right) {
        if (normalized[left] != normalized[right]) {
            return false;
        }
        left++;
        right--;
    }
    
    return true;
}

bool isAnagram(const std::string& str1, const std::string& str2) {
    std::string s1 = toLower(removeWhitespace(str1));
    std::string s2 = toLower(removeWhitespace(str2));
    
    if (s1.size() != s2.size()) {
        return false;
    }
    
    std::sort(s1.begin(), s1.end());
    std::sort(s2.begin(), s2.end());
    
    return s1 == s2;
}

std::string levenshteinDistance(const std::string& str1, const std::string& str2) {
    size_t m = str1.size();
    size_t n = str2.size();
    
    std::vector<std::vector<size_t>> dp(m + 1, std::vector<size_t>(n + 1, 0));
    
    for (size_t i = 0; i <= m; ++i) {
        dp[i][0] = i;
    }
    
    for (size_t j = 0; j <= n; ++j) {
        dp[0][j] = j;
    }
    
    for (size_t i = 1; i <= m; ++i) {
        for (size_t j = 1; j <= n; ++j) {
            if (str1[i - 1] == str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1];
            } else {
                dp[i][j] = 1 + std::min({dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]});
            }
        }
    }
    
    return std::to_string(dp[m][n]);
}

std::string longestCommonSubstring(const std::string& str1, const std::string& str2) {
    size_t m = str1.size();
    size_t n = str2.size();
    
    std::vector<std::vector<size_t>> dp(m + 1, std::vector<size_t>(n + 1, 0));
    size_t maxLength = 0;
    size_t endIndex = 0;
    
    for (size_t i = 1; i <= m; ++i) {
        for (size_t j = 1; j <= n; ++j) {
            if (str1[i - 1] == str2[j - 1]) {
                dp[i][j] = dp[i - 1][j - 1] + 1;
                if (dp[i][j] > maxLength) {
                    maxLength = dp[i][j];
                    endIndex = i;
                }
            }
        }
    }
    
    return str1.substr(endIndex - maxLength, maxLength);
}

std::string longestCommonPrefix(const std::vector<std::string>& strings) {
    if (strings.empty()) {
        return "";
    }
    
    std::string prefix = strings[0];
    
    for (size_t i = 1; i < strings.size(); ++i) {
        while (strings[i].find(prefix) != 0) {
            prefix = prefix.substr(0, prefix.size() - 1);
            if (prefix.empty()) {
                return "";
            }
        }
    }
    
    return prefix;
}

std::string longestCommonSuffix(const std::vector<std::string>& strings) {
    if (strings.empty()) {
        return "";
    }
    
    std::string suffix = strings[0];
    
    for (size_t i = 1; i < strings.size(); ++i) {
        std::string current = strings[i];
        while (!endsWith(current, suffix)) {
            suffix = suffix.substr(1);
            if (suffix.empty()) {
                return "";
            }
        }
    }
    
    return suffix;
}

std::string diff(const std::string& str1, const std::string& str2) {
    std::stringstream ss;
    size_t i = 0, j = 0;
    
    while (i < str1.size() || j < str2.size()) {
        if (i < str1.size() && j < str2.size() && str1[i] == str2[j]) {
            ss << "  " << str1[i] << std::endl;
            i++;
            j++;
        } else if (i < str1.size()) {
            ss << "- " << str1[i] << std::endl;
            i++;
        } else if (j < str2.size()) {
            ss << "+ " << str2[j] << std::endl;
            j++;
        }
    }
    
    return ss.str();
}

// Additional math utility functions
int clamp(int value, int min, int max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

double clamp(double value, double min, double max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

int lerp(int a, int b, double t) {
    return static_cast<int>(a + (b - a) * t);
}

double lerp(double a, double b, double t) {
    return a + (b - a) * t;
}

double degreesToRadians(double degrees) {
    return degrees * (M_PI / 180.0);
}

double radiansToDegrees(double radians) {
    return radians * (180.0 / M_PI);
}

double normalizeAngle(double degrees) {
    while (degrees < 0) degrees += 360;
    while (degrees >= 360) degrees -= 360;
    return degrees;
}

double distance(double x1, double y1, double x2, double y2) {
    double dx = x2 - x1;
    double dy = y2 - y1;
    return std::sqrt(dx * dx + dy * dy);
}

double distance3D(double x1, double y1, double z1, double x2, double y2, double z2) {
    double dx = x2 - x1;
    double dy = y2 - y1;
    double dz = z2 - z1;
    return std::sqrt(dx * dx + dy * dy + dz * dz);
}

bool isPowerOfTwo(int value) {
    return value > 0 && (value & (value - 1)) == 0;
}

int nextPowerOfTwo(int value) {
    if (value <= 0) return 1;
    value--;
    value |= value >> 1;
    value |= value >> 2;
    value |= value >> 4;
    value |= value >> 8;
    value |= value >> 16;
    return value + 1;
}

int greatestCommonDivisor(int a, int b) {
    while (b != 0) {
        int temp = b;
        b = a % b;
        a = temp;
    }
    return a;
}

int leastCommonMultiple(int a, int b) {
    return (a * b) / greatestCommonDivisor(a, b);
}

bool isPrime(int n) {
    if (n <= 1) return false;
    if (n <= 3) return true;
    if (n % 2 == 0 || n % 3 == 0) return false;
    
    for (int i = 5; i * i <= n; i += 6) {
        if (n % i == 0 || n % (i + 2) == 0) {
            return false;
        }
    }
    
    return true;
}

std::vector<int> generatePrimes(int n) {
    std::vector<bool> sieve(n + 1, true);
    sieve[0] = sieve[1] = false;
    
    for (int i = 2; i * i <= n; ++i) {
        if (sieve[i]) {
            for (int j = i * i; j <= n; j += i) {
                sieve[j] = false;
            }
        }
    }
    
    std::vector<int> primes;
    for (int i = 2; i <= n; ++i) {
        if (sieve[i]) {
            primes.push_back(i);
        }
    }
    
    return primes;
}

int fibonacci(int n) {
    if (n <= 0) return 0;
    if (n == 1) return 1;
    
    int a = 0, b = 1, c;
    for (int i = 2; i <= n; ++i) {
        c = a + b;
        a = b;
        b = c;
    }
    
    return b;
}

std::vector<int> fibonacciSequence(int n) {
    std::vector<int> sequence;
    if (n <= 0) return sequence;
    
    sequence.push_back(0);
    if (n == 1) return sequence;
    
    sequence.push_back(1);
    for (int i = 2; i < n; ++i) {
        sequence.push_back(sequence[i - 1] + sequence[i - 2]);
    }
    
    return sequence;
}

int factorial(int n) {
    if (n < 0) return 0;
    if (n <= 1) return 1;
    
    int result = 1;
    for (int i = 2; i <= n; ++i) {
        result *= i;
    }
    
    return result;
}

int binomialCoefficient(int n, int k) {
    if (k < 0 || k > n) return 0;
    if (k == 0 || k == n) return 1;
    
    k = std::min(k, n - k);
    int result = 1;
    
    for (int i = 0; i < k; ++i) {
        result = result * (n - i) / (i + 1);
    }
    
    return result;
}

double average(const std::vector<double>& values) {
    if (values.empty()) return 0.0;
    
    double sum = 0.0;
    for (double value : values) {
        sum += value;
    }
    
    return sum / values.size();
}

double median(std::vector<double> values) {
    if (values.empty()) return 0.0;
    
    std::sort(values.begin(), values.end());
    size_t mid = values.size() / 2;
    
    if (values.size() % 2 == 0) {
        return (values[mid - 1] + values[mid]) / 2.0;
    } else {
        return values[mid];
    }
}

double mode(const std::vector<double>& values) {
    if (values.empty()) return 0.0;
    
    std::map<double, int> frequency;
    for (double value : values) {
        frequency[value]++;
    }
    
    double modeValue = values[0];
    int maxFrequency = 0;
    
    for (const auto& [value, freq] : frequency) {
        if (freq > maxFrequency) {
            maxFrequency = freq;
            modeValue = value;
        }
    }
    
    return modeValue;
}

double standardDeviation(const std::vector<double>& values) {
    if (values.empty()) return 0.0;
    
    double avg = average(values);
    double sumSquaredDiff = 0.0;
    
    for (double value : values) {
        double diff = value - avg;
        sumSquaredDiff += diff * diff;
    }
    
    return std::sqrt(sumSquaredDiff / values.size());
}

double variance(const std::vector<double>& values) {
    double stdDev = standardDeviation(values);
    return stdDev * stdDev;
}

double percentile(const std::vector<double>& values, double percentile) {
    if (values.empty()) return 0.0;
    
    std::vector<double> sorted = values;
    std::sort(sorted.begin(), sorted.end());
    
    double index = (percentile / 100.0) * (sorted.size() - 1);
    size_t lower = static_cast<size_t>(std::floor(index));
    size_t upper = static_cast<size_t>(std::ceil(index));
    
    if (lower == upper) {
        return sorted[lower];
    }
    
    double weight = index - lower;
    return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

// Additional date/time utility functions
std::string formatTime(const std::chrono::system_clock::time_point& timePoint, const std::string& format) {
    auto time = std::chrono::system_clock::to_time_t(timePoint);
    std::stringstream ss;
    ss << std::put_time(std::localtime(&time), format.c_str());
    return ss.str();
}

std::chrono::system_clock::time_point addTime(const std::chrono::system_clock::time_point& timePoint, 
                                                int milliseconds) {
    return timePoint + std::chrono::milliseconds(milliseconds);
}

std::chrono::system_clock::time_point addSeconds(const std::chrono::system_clock::time_point& timePoint, 
                                                   int seconds) {
    return timePoint + std::chrono::seconds(seconds);
}

std::chrono::system_clock::time_point addMinutes(const std::chrono::system_clock::time_point& timePoint, 
                                                   int minutes) {
    return timePoint + std::chrono::minutes(minutes);
}

std::chrono::system_clock::time_point addHours(const std::chrono::system_clock::time_point& timePoint, 
                                                 int hours) {
    return timePoint + std::chrono::hours(hours);
}

std::chrono::system_clock::time_point addDays(const std::chrono::system_clock::time_point& timePoint, 
                                               int days) {
    return timePoint + std::chrono::hours(days * 24);
}

double timeDifferenceMs(const std::chrono::system_clock::time_point& start, 
                         const std::chrono::system_clock::time_point& end) {
    return std::chrono::duration<double, std::milli>(end - start).count();
}

double timeDifferenceSeconds(const std::chrono::system_clock::time_point& start, 
                              const std::chrono::system_clock::time_point& end) {
    return std::chrono::duration<double>(end - start).count();
}

bool isBefore(const std::chrono::system_clock::time_point& t1, 
               const std::chrono::system_clock::time_point& t2) {
    return t1 < t2;
}

bool isAfter(const std::chrono::system_clock::time_point& t1, 
              const std::chrono::system_clock::time_point& t2) {
    return t1 > t2;
}

bool isBetween(const std::chrono::system_clock::time_point& t, 
                const std::chrono::system_clock::time_point& start,
                const std::chrono::system_clock::time_point& end) {
    return t >= start && t <= end;
}

// Additional encoding/decoding utility functions
std::string htmlEncode(const std::string& str) {
    std::string result;
    result.reserve(str.size() * 1.2);
    
    for (char c : str) {
        switch (c) {
            case '&':  result += "&amp;"; break;
            case '<':  result += "&lt;"; break;
            case '>':  result += "&gt;"; break;
            case '"':  result += "&quot;"; break;
            case '\'': result += "&apos;"; break;
            default:   result += c;
        }
    }
    
    return result;
}

std::string htmlDecode(const std::string& str) {
    std::string result = str;
    result = replace(result, "&amp;", "&");
    result = replace(result, "&lt;", "<");
    result = replace(result, "&gt;", ">");
    result = replace(result, "&quot;", "\"");
    result = replace(result, "&apos;", "'");
    return result;
}

std::string xmlEscape(const std::string& str) {
    return htmlEncode(str);
}

std::string xmlUnescape(const std::string& str) {
    return htmlDecode(str);
}

std::string csvEscape(const std::string& str) {
    bool needsEscape = str.find(',') != std::string::npos ||
                       str.find('"') != std::string::npos ||
                       str.find('\n') != std::string::npos;
    
    if (!needsEscape) {
        return str;
    }
    
    std::string result = "\"";
    for (char c : str) {
        if (c == '"') {
            result += "\"\"";
        } else {
            result += c;
        }
    }
    result += "\"";
    
    return result;
}

std::string csvUnescape(const std::string& str) {
    if (str.empty() || str[0] != '"') {
        return str;
    }
    
    std::string result;
    bool inQuotes = false;
    
    for (size_t i = 0; i < str.size(); ++i) {
        if (i == 0 && str[i] == '"') {
            inQuotes = true;
        } else if (inQuotes && str[i] == '"' && i + 1 < str.size() && str[i + 1] == '"') {
            result += '"';
            i++;
        } else if (inQuotes && str[i] == '"') {
            inQuotes = false;
        } else {
            result += str[i];
        }
    }
    
    return result;
}

std::string jsonEscape(const std::string& str) {
    return escapeJsonString(str);
}

std::string jsonUnescape(const std::string& str) {
    return unescapeJsonString(str);
}

// Additional data structure utility functions
std::string mapToString(const std::map<std::string, std::string>& map) {
    std::stringstream ss;
    ss << "{";
    
    bool first = true;
    for (const auto& [key, value] : map) {
        if (!first) ss << ", ";
        ss << "\"" << key << "\": \"" << value << "\"";
        first = false;
    }
    
    ss << "}";
    return ss.str();
}

std::string vectorToString(const std::vector<std::string>& vec) {
    std::stringstream ss;
    ss << "[";
    
    for (size_t i = 0; i < vec.size(); ++i) {
        if (i > 0) ss << ", ";
        ss << "\"" << vec[i] << "\"";
    }
    
    ss << "]";
    return ss.str();
}

std::string setToString(const std::set<std::string>& set) {
    std::stringstream ss;
    ss << "{";
    
    bool first = true;
    for (const auto& item : set) {
        if (!first) ss << ", ";
        ss << "\"" << item << "\"";
        first = false;
    }
    
    ss << "}";
    return ss.str();
}

bool containsKey(const std::map<std::string, std::string>& map, const std::string& key) {
    return map.find(key) != map.end();
}

bool containsValue(const std::map<std::string, std::string>& map, const std::string& value) {
    for (const auto& [k, v] : map) {
        if (v == value) {
            return true;
        }
    }
    return false;
}

std::vector<std::string> mapKeys(const std::map<std::string, std::string>& map) {
    std::vector<std::string> keys;
    keys.reserve(map.size());
    
    for (const auto& [key, _] : map) {
        keys.push_back(key);
    }
    
    return keys;
}

std::vector<std::string> mapValues(const std::map<std::string, std::string>& map) {
    std::vector<std::string> values;
    values.reserve(map.size());
    
    for (const auto& [_, value] : map) {
        values.push_back(value);
    }
    
    return values;
}

std::map<std::string, std::string> invertMap(const std::map<std::string, std::string>& map) {
    std::map<std::string, std::string> inverted;
    
    for (const auto& [key, value] : map) {
        inverted[value] = key;
    }
    
    return inverted;
}

std::map<std::string, std::string> mergeMaps(const std::map<std::string, std::string>& map1,
                                                const std::map<std::string, std::string>& map2) {
    std::map<std::string, std::string> merged = map1;
    
    for (const auto& [key, value] : map2) {
        merged[key] = value;
    }
    
    return merged;
}

bool mapsEqual(const std::map<std::string, std::string>& map1,
                const std::map<std::string, std::string>& map2) {
    if (map1.size() != map2.size()) {
        return false;
    }
    
    return map1 == map2;
}

// Additional validation utility functions
bool isValidEmail(const std::string& email) {
    std::regex emailRegex(R"(^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$)");
    return std::regex_match(email, emailRegex);
}

bool isValidUrl(const std::string& url) {
    std::regex urlRegex(R"(^(https?|ftp)://[^\s/$.?#].[^\s]*$)");
    return std::regex_match(url, urlRegex);
}

bool isValidIPv4(const std::string& ip) {
    std::regex ipv4Regex(R"(^(\d{1,3}\.){3}\d{1,3}$)");
    if (!std::regex_match(ip, ipv4Regex)) {
        return false;
    }
    
    std::vector<std::string> parts = split(ip, '.');
    for (const auto& part : parts) {
        int value = toInt(part);
        if (value < 0 || value > 255) {
            return false;
        }
    }
    
    return true;
}

bool isValidIPv6(const std::string& ip) {
    std::regex ipv6Regex(R"(^([0-9a-fA-F]{0,4}:){7}[0-9a-fA-F]{0,4}$)");
    return std::regex_match(ip, ipv6Regex);
}

bool isValidMacAddress(const std::string& mac) {
    std::regex macRegex(R"(^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$)");
    return std::regex_match(mac, macRegex);
}

bool isValidPhoneNumber(const std::string& phone) {
    std::regex phoneRegex(R"(^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$)");
    return std::regex_match(phone, phoneRegex);
}

bool isValidCreditCard(const std::string& card) {
    std::string digits;
    for (char c : card) {
        if (std::isdigit(c)) {
            digits += c;
        }
    }
    
    if (digits.size() < 13 || digits.size() > 19) {
        return false;
    }
    
    int sum = 0;
    bool doubleDigit = false;
    
    for (int i = digits.size() - 1; i >= 0; --i) {
        int digit = digits[i] - '0';
        
        if (doubleDigit) {
            digit *= 2;
            if (digit > 9) {
                digit -= 9;
            }
        }
        
        sum += digit;
        doubleDigit = !doubleDigit;
    }
    
    return sum % 10 == 0;
}

bool isValidSSN(const std::string& ssn) {
    std::regex ssnRegex(R"(^\d{3}-\d{2}-\d{4}$)");
    return std::regex_match(ssn, ssnRegex);
}

bool isValidPostalCode(const std::string& code) {
    std::regex postalRegex(R"(^\d{5}(-\d{4})?$)");
    return std::regex_match(code, postalRegex);
}

bool isValidHexColor(const std::string& color) {
    std::regex hexRegex(R"(^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$)");
    return std::regex_match(color, hexRegex);
}

bool isValidBase64(const std::string& str) {
    std::regex base64Regex(R"(^[A-Za-z0-9+/]*={0,2}$)");
    if (!std::regex_match(str, base64Regex)) {
        return false;
    }
    
    if (str.size() % 4 != 0) {
        return false;
    }
    
    return true;
}

bool isValidJson(const std::string& str) {
    // Basic JSON validation - in production, use a proper JSON parser
    if (str.empty()) {
        return false;
    }
    
    std::string trimmed = trim(str);
    if (trimmed[0] != '{' && trimmed[0] != '[') {
        return false;
    }
    
    int braceCount = 0;
    int bracketCount = 0;
    
    for (char c : trimmed) {
        if (c == '{') braceCount++;
        else if (c == '}') braceCount--;
        else if (c == '[') bracketCount++;
        else if (c == ']') bracketCount--;
        
        if (braceCount < 0 || bracketCount < 0) {
            return false;
        }
    }
    
    return braceCount == 0 && bracketCount == 0;
}

bool isValidXml(const std::string& str) {
    // Basic XML validation - in production, use a proper XML parser
    if (str.empty()) {
        return false;
    }
    
    std::string trimmed = trim(str);
    if (trimmed.find("<?xml") != 0) {
        return false;
    }
    
    int tagCount = 0;
    bool inTag = false;
    
    for (char c : trimmed) {
        if (c == '<') {
            inTag = true;
            tagCount++;
        } else if (c == '>') {
            inTag = false;
        }
    }
    
    return tagCount >= 2 && !inTag;
}

// Additional security utility functions
std::string generateSalt(size_t length) {
    return randomBytes(length);
}

std::string hashPassword(const std::string& password, const std::string& salt) {
    // Placeholder for password hashing
    // In production, use bcrypt, Argon2, or PBKDF2
    return sha256Hash(password + salt);
}

bool verifyPassword(const std::string& password, const std::string& hash, const std::string& salt) {
    return hashPassword(password, salt) == hash;
}

std::string generateToken(size_t length) {
    return randomString(length);
}

std::string generateApiKey(size_t length) {
    static const char charset[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    static std::random_device rd;
    static std::mt19937 gen(rd());
    static std::uniform_int_distribution<> dis(0, sizeof(charset) - 2);
    
    std::string result;
    result.reserve(length);
    
    for (size_t i = 0; i < length; ++i) {
        if (i > 0 && i % 4 == 0) {
            result += '-';
        }
        result += charset[dis(gen)];
    }
    
    return result;
}

std::string sanitizeInput(const std::string& input) {
    std::string result;
    for (char c : input) {
        if (std::isprint(c) && c != '\n' && c != '\r' && c != '\t') {
            result += c;
        }
    }
    return trim(result);
}

std::string sanitizeHtml(const std::string& html) {
    // Basic HTML sanitization
    std::string result = html;
    
    // Remove script tags
    std::regex scriptRegex(R"(<script[^>]*>.*?</script>)", std::regex_constants::icase);
    result = std::regex_replace(result, scriptRegex, "");
    
    // Remove style tags
    std::regex styleRegex(R"(<style[^>]*>.*?</style>)", std::regex_constants::icase);
    result = std::regex_replace(result, styleRegex, "");
    
    // Remove iframe tags
    std::regex iframeRegex(R"(<iframe[^>]*>.*?</iframe>)", std::regex_constants::icase);
    result = std::regex_replace(result, iframeRegex, "");
    
    return result;
}

std::string sanitizeSql(const std::string& sql) {
    // Basic SQL injection prevention
    std::string result = sql;
    result = replace(result, "'", "''");
    result = replace(result, "\"", "\"\"");
    return result;
}

// Additional file utility functions
std::string readFile(const std::string& path) {
    std::ifstream file(path);
    if (!file.is_open()) {
        throw std::runtime_error("Cannot open file for reading: " + path);
    }
    
    std::string content((std::istreambuf_iterator<char>(file)),
                       std::istreambuf_iterator<char>());
    
    return content;
}

std::vector<std::string> readFileLines(const std::string& path) {
    std::ifstream file(path);
    if (!file.is_open()) {
        throw std::runtime_error("Cannot open file for reading: " + path);
    }
    
    std::vector<std::string> lines;
    std::string line;
    
    while (std::getline(file, line)) {
        lines.push_back(line);
    }
    
    return lines;
}

void writeFile(const std::string& path, const std::string& content) {
    std::ofstream file(path);
    if (!file.is_open()) {
        throw std::runtime_error("Cannot open file for writing: " + path);
    }
    
    file << content;
}

void writeFileLines(const std::string& path, const std::vector<std::string>& lines) {
    std::ofstream file(path);
    if (!file.is_open()) {
        throw std::runtime_error("Cannot open file for writing: " + path);
    }
    
    for (const auto& line : lines) {
        file << line << std::endl;
    }
}

void appendToFile(const std::string& path, const std::string& content) {
    std::ofstream file(path, std::ios::app);
    if (!file.is_open()) {
        throw std::runtime_error("Cannot open file for appending: " + path);
    }
    
    file << content;
}

std::vector<std::string> listFiles(const std::string& directory) {
    std::vector<std::string> files;
    
    if (fs::exists(directory) && fs::is_directory(directory)) {
        for (const auto& entry : fs::directory_iterator(directory)) {
            if (fs::is_regular_file(entry)) {
                files.push_back(entry.path().string());
            }
        }
    }
    
    return files;
}

std::vector<std::string> listDirectories(const std::string& directory) {
    std::vector<std::string> directories;
    
    if (fs::exists(directory) && fs::is_directory(directory)) {
        for (const auto& entry : fs::directory_iterator(directory)) {
            if (fs::is_directory(entry)) {
                directories.push_back(entry.path().string());
            }
        }
    }
    
    return directories;
}

std::vector<std::string> listFilesRecursive(const std::string& directory) {
    std::vector<std::string> files;
    
    if (fs::exists(directory) && fs::is_directory(directory)) {
        for (const auto& entry : fs::recursive_directory_iterator(directory)) {
            if (fs::is_regular_file(entry)) {
                files.push_back(entry.path().string());
            }
        }
    }
    
    return files;
}

std::string getFileExtension(const std::string& path) {
    size_t pos = path.find_last_of('.');
    return (pos == std::string::npos) ? "" : path.substr(pos);
}

std::string changeExtension(const std::string& path, const std::string& newExtension) {
    size_t pos = path.find_last_of('.');
    if (pos == std::string::npos) {
        return path + newExtension;
    }
    
    return path.substr(0, pos) + newExtension;
}

// Additional network utility functions
std::string getLocalIpAddress() {
    // Placeholder for getting local IP address
    // In production, use platform-specific networking APIs
    return "127.0.0.1";
}

std::string getHostName() {
    // Placeholder for getting hostname
    // In production, use platform-specific networking APIs
    return "localhost";
}

bool isPortOpen(const std::string& host, int port) {
    // Placeholder for port checking
    // In production, use socket operations
    return false;
}

bool pingHost(const std::string& host) {
    // Placeholder for ping functionality
    // In production, use ICMP or platform-specific ping
    return true;
}

std::string resolveHostname(const std::string& hostname) {
    // Placeholder for DNS resolution
    // In production, use getaddrinfo or similar
    return hostname;
}

// Additional system utility functions
std::string getEnvironmentVariable(const std::string& name) {
    const char* value = std::getenv(name.c_str());
    return value ? value : "";
}

void setEnvironmentVariable(const std::string& name, const std::string& value) {
#ifdef _WIN32
    _putenv_s(name.c_str(), value.c_str());
#else
    setenv(name.c_str(), value.c_str(), 1);
#endif
}

std::string getOperatingSystem() {
#ifdef _WIN32
    return "Windows";
#elif __APPLE__
    return "macOS";
#elif __linux__
    return "Linux";
#else
    return "Unknown";
#endif
}

std::string getArchitecture() {
#ifdef _WIN64
    return "x64";
#elif _WIN32
    return "x86";
#elif __x86_64__
    return "x64";
#elif __i386__
    return "x86";
#elif __arm64__
    return "ARM64";
#elif __arm__
    return "ARM";
#else
    return "Unknown";
#endif
}

std::string getCompiler() {
#ifdef _MSC_VER
    return "MSVC";
#elif __GNUC__
    return "GCC";
#elif __clang__
    return "Clang";
#else
    return "Unknown";
#endif
}

int getCompilerVersion() {
#ifdef _MSC_VER
    return _MSC_VER;
#elif __GNUC__
    return __GNUC__;
#elif __clang__
    return __clang_major__;
#else
    return 0;
#endif
}

bool isDebugBuild() {
#ifndef NDEBUG
    return true;
#else
    return false;
#endif
}

// Additional conversion utility functions
std::string boolToString(bool value) {
    return value ? "true" : "false";
}

bool stringToBool(const std::string& str) {
    std::string upper = toUpper(trim(str));
    return upper == "TRUE" || upper == "1" || upper == "YES" || upper == "Y";
}

std::string bytesToString(size_t bytes) {
    const char* units[] = {"B", "KB", "MB", "GB", "TB", "PB"};
    int unitIndex = 0;
    double value = static_cast<double>(bytes);
    
    while (value >= 1024 && unitIndex < 6) {
        value /= 1024;
        unitIndex++;
    }
    
    std::stringstream ss;
    ss << std::fixed << std::setprecision(2) << value << " " << units[unitIndex];
    return ss.str();
}

size_t stringToBytes(const std::string& str) {
    std::string upper = toUpper(trim(str));
    
    size_t multiplier = 1;
    if (upper.find("KB") != std::string::npos || upper.find("K") != std::string::npos) {
        multiplier = 1024;
    } else if (upper.find("MB") != std::string::npos || upper.find("M") != std::string::npos) {
        multiplier = 1024 * 1024;
    } else if (upper.find("GB") != std::string::npos || upper.find("G") != std::string::npos) {
        multiplier = 1024 * 1024 * 1024;
    } else if (upper.find("TB") != std::string::npos || upper.find("T") != std::string::npos) {
        multiplier = static_cast<size_t>(1024) * 1024 * 1024 * 1024;
    } else if (upper.find("PB") != std::string::npos || upper.find("P") != std::string::npos) {
        multiplier = static_cast<size_t>(1024) * 1024 * 1024 * 1024 * 1024;
    }
    
    std::string numericPart = upper;
    for (char c : "KMGTPE") {
        numericPart.erase(std::remove(numericPart.begin(), numericPart.end(), c), numericPart.end());
    }
    for (char c : "B") {
        numericPart.erase(std::remove(numericPart.begin(), numericPart.end(), c), numericPart.end());
    }
    
    double value = toDouble(trim(numericPart));
    return static_cast<size_t>(value * multiplier);
}

} // namespace utils

} // namespace thinking
} // namespace nexus

// ============================================================================
// Example Usage / Main Function
// ============================================================================

#ifdef THINKING_STANDALONE

#include <iostream>

using namespace nexus::thinking;

int main() {
    std::cout << "=== Nexus AI Thinking Module ===" << std::endl;
    std::cout << std::endl;
    
    // Create ThinkingManager
    ThinkingManager manager;
    
    // Set up callbacks
    manager.setStepCallback([](const ThinkingStep& step) {
        std::cout << "[Step] " << step.label << " - " << utils::statusToString(step.status) << std::endl;
    });
    
    manager.setProgressCallback([](double progress) {
        std::cout << "[Progress] " << (progress * 100.0) << "%" << std::endl;
    });
    
    // Create a session
    std::string sessionId = manager.createSession("msg_123");
    std::cout << "Created session: " << sessionId << std::endl;
    
    // Add thinking steps
    manager.addStep(sessionId, "Deep Analysis Initiated", 0);
    manager.addStep(sessionId, "Getting Started", 1);
    manager.addStep(sessionId, "Fetching paths", 2);
    manager.addStep(sessionId, "Mapping Logical Paths", 3);
    manager.addStep(sessionId, "Synthesizing Insights", 4);
    
    std::cout << "Added " << manager.getTotalSteps(sessionId) << " steps" << std::endl;
    std::cout << std::endl;
    
    // Create and start ThinkingService
    ThinkingService service;
    service.start();
    
    // Process the session
    std::cout << "Processing session..." << std::endl;
    service.processSessionAsync(sessionId, [](bool success) {
        std::cout << "Processing " << (success ? "completed" : "failed") << std::endl;
    });
    
    // Wait for processing to complete
    std::this_thread::sleep_for(std::chrono::seconds(2));
    
    // Stop the service
    service.stop();
    
    // Print session JSON
    std::cout << std::endl;
    std::cout << "=== Session JSON ===" << std::endl;
    std::cout << manager.sessionToJson(sessionId) << std::endl;
    
    // Print statistics
    std::cout << std::endl;
    std::cout << "=== Statistics ===" << std::endl;
    std::cout << "Processed: " << service.getProcessedCount() << std::endl;
    std::cout << "Failed: " << service.getFailedCount() << std::endl;
    std::cout << "Average Time: " << service.getAverageProcessingTimeMs() << "ms" << std::endl;
    
    return 0;
}

#endif // THINKING_STANDALONE