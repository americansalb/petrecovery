'use client';

/**
 * New Thread Page with Templates
 *
 * Create a new discussion thread using helpful templates.
 */

import { useState, useEffect, Suspense } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, Send, AlertTriangle, MapPin, Loader2,
  Search, Heart, Truck, Trophy, HelpCircle, MessageSquare,
  ChevronRight, X, Sparkles
} from 'lucide-react';

// Thread templates with pre-filled content
const THREAD_TEMPLATES = [
  {
    id: 'lost-pet',
    name: 'Lost Pet Alert',
    icon: '🚨',
    color: 'bg-red-100 text-red-700 border-red-200',
    category: 'lost-pet-support',
    urgency: 'URGENT',
    description: 'Report a lost pet and get community help searching',
    titleTemplate: 'LOST: [Pet Name] - [Breed] in [City, State]',
    contentTemplate: `**Pet Information:**
- Name:
- Species: Dog / Cat / Other
- Breed:
- Color/Markings:
- Age:
- Size: Small / Medium / Large
- Microchipped: Yes / No
- Collar/Tags:

**Last Seen:**
- Date/Time:
- Location:
- Direction heading:

**Personality:**
(Is your pet friendly? Shy? Will they come when called?)

**Contact:**
- Phone:
- Best way to reach you:

**Photos:**
(Describe or note that photos are attached)

---
Please share this post! Every share helps bring them home. 🙏`,
  },
  {
    id: 'found-pet',
    name: 'Found Pet Report',
    icon: '🔍',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    category: 'found-pet-help',
    urgency: 'NORMAL',
    description: 'Report a pet you found to help reunite them',
    titleTemplate: 'FOUND: [Description] in [City, State]',
    contentTemplate: `**Pet Description:**
- Species: Dog / Cat / Other
- Breed (if known):
- Color/Markings:
- Approximate Age:
- Size: Small / Medium / Large
- Collar/Tags:
- Microchip scanned: Yes / No / Not yet

**Found Location:**
- Date/Time:
- Exact location:
- Circumstances:

**Current Status:**
- Where is the pet now:
- Has vet checked: Yes / No

**Contact:**
- Phone:
- Best way to reach you:

---
I'll update this post as I get more information. If this is your pet, please be prepared to provide proof of ownership.`,
  },
  {
    id: 'transport',
    name: 'Transport Request',
    icon: '🚗',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    category: 'transport',
    urgency: 'NORMAL',
    description: 'Request help transporting a rescue animal',
    titleTemplate: 'TRANSPORT NEEDED: [Origin] to [Destination]',
    contentTemplate: `**Transport Details:**
- Animal:
- Breed/Size:
- Temperament:

**Route:**
- From:
- To:
- Deadline:
- Flexible on dates: Yes / No

**Requirements:**
- Crate provided: Yes / No
- Special needs:
- Vet records available: Yes / No

**Legs Needed:**
Please comment if you can cover any portion of this route!

**Coordinator Contact:**
- Name:
- Phone/Email:

---
Thank you to everyone in the transport network! 💜`,
  },
  {
    id: 'success-story',
    name: 'Success Story',
    icon: '🎉',
    color: 'bg-green-100 text-green-700 border-green-200',
    category: 'success-stories',
    urgency: 'NORMAL',
    description: 'Share your reunion or rescue success!',
    titleTemplate: 'REUNITED: [Pet Name] is home! 🎉',
    contentTemplate: `**The Happy Ending:**
(Tell us about the reunion moment!)

**The Journey:**
- How long was [pet name] missing:
- How were they found:
- Distance from home:

**What Helped:**
(Flyers? Social media? This community? Microchip?)

**Tips for Others:**
(What advice would you give to someone in the same situation?)

**Thank You:**
(Shout out to anyone who helped!)

---
Never give up hope! 🌟`,
  },
  {
    id: 'question',
    name: 'Ask a Question',
    icon: '❓',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    category: 'general',
    urgency: 'NORMAL',
    description: 'Get advice from the community',
    titleTemplate: '',
    contentTemplate: `**My Question:**


**Background:**
(Context that might help people answer)

**What I've Tried:**
(Any steps you've already taken)

---
Thanks in advance for any help!`,
  },
  {
    id: 'blank',
    name: 'Blank Post',
    icon: '📝',
    color: 'bg-gray-100 text-gray-700 border-gray-200',
    category: '',
    urgency: 'NORMAL',
    description: 'Start from scratch',
    titleTemplate: '',
    contentTemplate: '',
  },
];

function NewThreadForm() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedCategory = searchParams.get('category');
  const preselectedTemplate = searchParams.get('template');

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [showTemplates, setShowTemplates] = useState(!preselectedTemplate);

  const [formData, setFormData] = useState({
    title: '',
    content: '',
    categorySlug: preselectedCategory || '',
    locationTag: '',
    urgencyLevel: 'NORMAL',
  });

  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/login?redirect=/hub/new');
      return;
    }

    fetchCategories();
  }, [authStatus, router]);

  useEffect(() => {
    // Auto-select template if provided in URL
    if (preselectedTemplate && !selectedTemplate) {
      const template = THREAD_TEMPLATES.find(t => t.id === preselectedTemplate);
      if (template) {
        handleSelectTemplate(template);
      }
    }
  }, [preselectedTemplate]);

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/hub/categories');
      const data = await res.json();
      if (data.success) {
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (template) => {
    setSelectedTemplate(template);
    setShowTemplates(false);
    setFormData({
      ...formData,
      title: template.titleTemplate,
      content: template.contentTemplate,
      categorySlug: template.category || formData.categorySlug,
      urgencyLevel: template.urgency || 'NORMAL',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.content.trim() || !formData.categorySlug) {
      setError('Please fill in all required fields');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const res = await fetch('/api/hub/threads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (data.success) {
        router.push(`/hub/thread/${data.thread.slug}`);
      } else if (data.code === 'EMAIL_NOT_VERIFIED') {
        setError('Please verify your email to post on the forum. Check your inbox for a verification link.');
      } else {
        setError(data.error || 'Failed to create thread');
      }
    } catch (err) {
      setError('Failed to create thread. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (authStatus === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 size={40} className="animate-spin text-indigo-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <Link
            href="/hub"
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft size={20} />
            Back to Hub
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Template Selection */}
        {showTemplates ? (
          <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
            <div className="flex items-center gap-3 mb-6">
              <Sparkles className="w-6 h-6 text-indigo-500" />
              <h1 className="text-2xl font-bold text-gray-800">
                What would you like to post?
              </h1>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {THREAD_TEMPLATES.map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleSelectTemplate(template)}
                  className={`p-4 rounded-xl border-2 text-left hover:shadow-md transition-all ${template.color} hover:scale-[1.02]`}
                >
                  <div className="text-3xl mb-2">{template.icon}</div>
                  <h3 className="font-semibold mb-1">{template.name}</h3>
                  <p className="text-sm opacity-80">{template.description}</p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Selected Template Badge */}
            {selectedTemplate && selectedTemplate.id !== 'blank' && (
              <div className="mb-4 flex items-center gap-2">
                <span className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${selectedTemplate.color}`}>
                  <span>{selectedTemplate.icon}</span>
                  {selectedTemplate.name}
                </span>
                <button
                  onClick={() => setShowTemplates(true)}
                  className="text-sm text-gray-500 hover:text-gray-700"
                >
                  Change template
                </button>
              </div>
            )}

            {/* Form */}
            <div className="bg-white rounded-xl shadow-sm p-6">
              <h1 className="text-2xl font-bold text-gray-800 mb-6">
                {selectedTemplate?.id === 'blank' ? 'Start a New Discussion' : `Create ${selectedTemplate?.name || 'Post'}`}
              </h1>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Category */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    value={formData.categorySlug}
                    onChange={(e) => setFormData({ ...formData, categorySlug: e.target.value })}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select a category</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.slug}>
                        {cat.icon} {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder={selectedTemplate?.titleTemplate || "What's your discussion about?"}
                    maxLength={200}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    required
                  />
                  <p className="mt-1 text-sm text-gray-400">
                    {formData.title.length}/200 characters
                  </p>
                </div>

                {/* Content */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Content *
                  </label>
                  <textarea
                    value={formData.content}
                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                    placeholder="Fill in the details..."
                    rows={16}
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none font-mono text-sm"
                    required
                  />
                  <p className="mt-1 text-sm text-gray-400">
                    Supports **bold**, *italic*, and line breaks
                  </p>
                </div>

                {/* Location Tag */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin size={16} className="inline mr-1" />
                    Location (optional)
                  </label>
                  <input
                    type="text"
                    value={formData.locationTag}
                    onChange={(e) => setFormData({ ...formData, locationTag: e.target.value })}
                    placeholder="e.g., Austin, TX or Northeast Ohio"
                    className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>

                {/* Urgency Level */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <AlertTriangle size={16} className="inline mr-1" />
                    Urgency Level
                  </label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="urgency"
                        value="NORMAL"
                        checked={formData.urgencyLevel === 'NORMAL'}
                        onChange={(e) => setFormData({ ...formData, urgencyLevel: e.target.value })}
                        className="w-4 h-4 text-indigo-600"
                      />
                      <span className="text-gray-700">Normal</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="urgency"
                        value="URGENT"
                        checked={formData.urgencyLevel === 'URGENT'}
                        onChange={(e) => setFormData({ ...formData, urgencyLevel: e.target.value })}
                        className="w-4 h-4 text-amber-600"
                      />
                      <span className="text-amber-700">Urgent</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="urgency"
                        value="CRITICAL"
                        checked={formData.urgencyLevel === 'CRITICAL'}
                        onChange={(e) => setFormData({ ...formData, urgencyLevel: e.target.value })}
                        className="w-4 h-4 text-red-600"
                      />
                      <span className="text-red-700">Critical</span>
                    </label>
                  </div>
                </div>

                {/* Submit */}
                <div className="flex justify-between items-center pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowTemplates(true)}
                    className="text-gray-500 hover:text-gray-700 text-sm"
                  >
                    ← Choose different template
                  </button>
                  <div className="flex gap-4">
                    <Link
                      href="/hub"
                      className="px-6 py-2 text-gray-600 hover:text-gray-800 font-medium transition-colors"
                    >
                      Cancel
                    </Link>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {submitting ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Send size={18} />
                      )}
                      Post
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </>
        )}

        {/* Tips */}
        <div className="mt-6 bg-indigo-50 rounded-xl p-6">
          <h3 className="font-semibold text-indigo-800 mb-3">Tips for a great post</h3>
          <ul className="space-y-2 text-sm text-indigo-700">
            <li>• Write a clear, descriptive title that summarizes your post</li>
            <li>• Include all relevant details - the more info, the better</li>
            <li>• Add your location if it's relevant to finding/helping</li>
            <li>• Use the template fields as a guide, but personalize them</li>
            <li>• Only mark as Urgent/Critical if truly time-sensitive</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default function NewThreadPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-indigo-500" />
      </div>
    }>
      <NewThreadForm />
    </Suspense>
  );
}
